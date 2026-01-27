import type { BenefitsPayload } from "../../../models/benefits";
import { withMinCreditConfidence } from "../creditConfidence";
import { parseGeneric } from "../genericParser";
import { cleanExtractedLines } from "../lineCleanup";
import {
  collectHtmlValuesFromJson,
  collectStringsFromJson,
  extractIssuerBenefitsFromJson,
  extractJsonBlobs,
  mergeBenefitsPayload,
} from "../jsonExtract";
import { capitalOneJsonMap } from "../issuerJsonMaps";

const keyRegex =
  /(benefit|feature|reward|perk|offer|headline|subheadline|description|copy|earning|points|miles|cash|credit|annual fee|apr|rate)/i;
const valueRegex =
  /(credit|statement|points|miles|cash back|cashback|reward|benefit|annual fee|apr|%|\bx\b|travel|dining|grocery|hotel|lounge|bonus|anniversary|monthly|annual)/i;

const tokenKeyRegex = /^[A-Z0-9_]{4,}$/;
const tokenIdCandidates = ["id", "key", "name", "code", "token", "tokenName", "productKey"];
const tokenValueCandidates = ["value", "displayValue", "text", "amount", "label", "copy", "tokenValue"];

function extractTokenKeysFromTemplates(lines: string[]): Set<string> {
  const keys = new Set<string>();
  for (const line of lines) {
    const matches = line.matchAll(/\$\{product:([A-Z0-9_]+)(?::[^}]*)?\}/g);
    for (const match of matches) {
      if (match[1]) keys.add(match[1]);
    }
  }
  return keys;
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
}

function extractTokenMapFromText(text: string, tokenKeys: Set<string>): Record<string, string> {
  const map: Record<string, string> = {};
  if (!tokenKeys.size) return map;

  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const key of tokenKeys) {
    const keyPattern = escape(key);
    const stringRegex = new RegExp(`"${keyPattern}"\\s*:\\s*"([^"]{1,120})"`, "g");
    const numberRegex = new RegExp(`"${keyPattern}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`, "g");
    let match = stringRegex.exec(text);
    if (match?.[1]) {
      const decoded = decodeJsonString(match[1]).trim();
      if (decoded) {
        map[key] = decoded;
        continue;
      }
    }
    match = numberRegex.exec(text);
    if (match?.[1]) {
      map[key] = match[1];
    }
  }
  return map;
}

function extractTokenMapFromJson(blobs: unknown[]): Record<string, string> {
  const map: Record<string, string> = {};

  function addToken(key: string, value: unknown) {
    if (!tokenKeyRegex.test(key)) return;
    if (value == null) return;
    const normalized =
      typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
    if (!normalized || normalized.length > 120) return;
    if (map[key]) return;
    map[key] = normalized;
  }

  function walk(node: unknown) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;

    const entry = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(entry)) {
      if (tokenKeyRegex.test(k)) addToken(k, v);
    }

    const id = tokenIdCandidates.map((k) => entry[k]).find((v) => typeof v === "string") as
      | string
      | undefined;
    if (id && tokenKeyRegex.test(id)) {
      const value = tokenValueCandidates.map((k) => entry[k]).find((v) => v != null);
      addToken(id, value);
    }

    Object.values(entry).forEach(walk);
  }

  blobs.forEach(walk);
  return map;
}

function resolveTemplates(text: string, tokenMap: Record<string, string>): string {
  const resolved = text
    .replace(/\$\{product:([A-Z0-9_]+)(:[^}]*)?\}/g, (_, key: string) => tokenMap[key] ?? "")
    .replace(/\$\{footnote:[^}]+\}/g, "")
    .replace(/\$\{scroll:[^}]+\}/g, "")
    .replace(/\$\{[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return resolved;
}

export function parseCapitalOne(text: string, url?: string): BenefitsPayload {
  const base = parseGeneric(text, url);
  const blobs = extractJsonBlobs(text);
  if (process.env.DEBUG_ISSUER_JSON === "1") {
    console.log("[capitalone] json blobs:", blobs.length);
  }
  const mapped = extractIssuerBenefitsFromJson(blobs, capitalOneJsonMap, url);
  const strings = collectStringsFromJson(blobs, { keyRegex, valueRegex, max: 240 });
  const htmlStrings = collectHtmlValuesFromJson(blobs, { max: 240, contentTypeRegex: /html/i });
  const tokenKeys = extractTokenKeysFromTemplates(htmlStrings);
  const tokenMap = {
    ...extractTokenMapFromJson(blobs),
    ...extractTokenMapFromText(text, tokenKeys),
  };
  const resolvedHtmlStrings = htmlStrings
    .map((line) => resolveTemplates(line, tokenMap))
    .filter((line) => line.length > 8);
  if (process.env.DEBUG_ISSUER_JSON === "1") {
    console.log("[capitalone] collected strings:", strings.length);
    console.log("[capitalone] sample strings:", strings.slice(0, 20));
    console.log("[capitalone] html strings:", htmlStrings.length);
    console.log("[capitalone] html sample:", htmlStrings.slice(0, 8));
    console.log("[capitalone] token map size:", Object.keys(tokenMap).length);
    console.log("[capitalone] resolved html sample:", resolvedHtmlStrings.slice(0, 8));
  }
  let combined = mergeBenefitsPayload(base, mapped);
  const mergedStrings = cleanExtractedLines([...strings, ...resolvedHtmlStrings]);
  if (!mergedStrings.length) return combined;
  const extra = parseGeneric(mergedStrings.join("\n"), url);
  extra.confidence = Math.max(extra.confidence || 0, 0.55);
  return mergeBenefitsPayload(combined, withMinCreditConfidence(extra, 0.72));
}
