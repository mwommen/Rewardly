import {
  buildIssuerHealthReport,
  buildIssuerRegistryReport,
  createIssuerAdapter,
  detectIssuerSourceChange,
  getIssuer,
  listIssuerProducts,
  listIssuers,
  mapBenefitName,
  runIssuerAdapterTest,
  validateProductCatalog,
  type IssuerId,
} from "./services/issuerIntelligenceService";

const command = process.argv[2] || "help";
const issuerArg = (process.argv[3] || "american-express") as IssuerId;
const hasIssuerArg = Boolean(process.argv[3]);

function run() {
  if (command === "list") {
    print({ issuers: listIssuers() });
    return;
  }
  if (command === "health") {
    print({ health: listIssuers().map((issuer) => buildIssuerHealthReport(issuer.issuerId)) });
    return;
  }
  if (command === "test") {
    print(runIssuerAdapterTest(issuerArg));
    return;
  }
  if (command === "compare") {
    const adapter = createIssuerAdapter(issuerArg);
    const runResult = runIssuerAdapterTest(issuerArg);
    print({
      issuerId: issuerArg,
      comparisons: adapter.compareChanges(runResult.extraction.normalizedBenefits, []),
    });
    return;
  }
  if (command === "validate") {
    const runResult = runIssuerAdapterTest(issuerArg);
    print({
      issuerId: issuerArg,
      validation: runResult.validation,
      catalog: validateProductCatalog(),
    });
    return;
  }
  if (command === "catalog") {
    print({ products: listIssuerProducts(hasIssuerArg ? getIssuer(issuerArg)?.issuerId : undefined) });
    return;
  }
  if (command === "registry") {
    print(buildIssuerRegistryReport());
    return;
  }
  if (command === "mapping") {
    const rawName = process.argv.slice(3).join(" ") || "Monthly Dining Benefit";
    print(mapBenefitName(rawName));
    return;
  }
  if (command === "source-change") {
    const runResult = runIssuerAdapterTest(issuerArg);
    print(
      detectIssuerSourceChange({
        issuerId: issuerArg,
        source: runResult.source,
        payloadText: "unexpected page redesign",
        previousChecksum: "checksum_previous",
      }),
    );
    return;
  }
  print({
    usage:
      "ts-node src/issuerIntelligenceCli.ts list|health|test|compare|validate|catalog|registry|mapping|source-change [issuerId]",
  });
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

run();
