import {
  auditMerchantRegistry,
  listMerchantAliases,
  listMerchantMccProfiles,
  resolveMerchant,
} from "./services/merchantIntelligenceService";

const command = process.argv[2] || "help";
const args = process.argv.slice(3);

function run() {
  if (command === "audit") {
    print(auditMerchantRegistry());
    return;
  }
  if (command === "resolve") {
    print(
      resolveMerchant({
        merchant: args.join(" ") || "AMZN Mktp",
        billingDescriptor: args.join(" ") || "AMZN Mktp",
      }),
    );
    return;
  }
  if (command === "aliases") {
    print(listMerchantAliases());
    return;
  }
  if (command === "mcc") {
    print(listMerchantMccProfiles());
    return;
  }
  if (command === "confidence") {
    const fixtures = [
      { merchant: "Amazon", expected: "exact alias" },
      { billingDescriptor: "AMZN Mktp", expected: "billing descriptor" },
      { hostname: "www.amazon.com", expected: "domain" },
      { mcc: "5411", merchant: "grocery", expected: "MCC/category" },
      { merchant: "unknown merchant", expected: "unknown" },
    ];
    print(fixtures.map((fixture) => ({ fixture, result: resolveMerchant(fixture) })));
    return;
  }
  print({
    usage:
      "ts-node src/merchantIntelligenceCli.ts audit|resolve|aliases|mcc|confidence",
  });
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

run();
