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
import { citiJsonMap } from "../issuerJsonMaps";

const keyRegex =
  /(benefit|feature|reward|perk|offer|headline|subheadline|description|copy|earning|points|thankyou|credit|annual fee|apr|rate)/i;
const valueRegex =
  /(credit|statement|thankyou|points|miles|cash back|cashback|reward|benefit|annual fee|apr|%|\bx\b|dining|grocery|gas|transit|hotel|lounge|bonus|anniversary|monthly|annual)/i;

export function parseCiti(text: string, url?: string): BenefitsPayload {
  const base = parseGeneric(text, url);
  const blobs = extractJsonBlobs(text);
  const mapped = extractIssuerBenefitsFromJson(blobs, citiJsonMap, url);
  const strings = collectStringsFromJson(blobs, { keyRegex, valueRegex, max: 240 });
  const htmlStrings = collectHtmlValuesFromJson(blobs, {
    max: 240,
    contentTypeRegex: /html|richtext/i,
  });
  let combined = mergeBenefitsPayload(base, mapped);
  const mergedStrings = cleanExtractedLines([...strings, ...htmlStrings]);
  if (!mergedStrings.length) return combined;
  const extra = parseGeneric(mergedStrings.join("\n"), url);
  extra.confidence = Math.max(extra.confidence || 0, 0.55);
  return mergeBenefitsPayload(combined, withMinCreditConfidence(extra, 0.72));
}
