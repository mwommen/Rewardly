import type { Card as WalletCard } from "../cardModules";
import { Badge, Button, Card } from "../design-system/components";
import {
  DEMO_MERCHANTS,
  SUPPORTED_MERCHANT_GROUPS,
  browserValidationFor,
  setupChecksFor,
  setupProgress,
} from "../lib/onboarding";

type FirstTimeOnboardingProps = {
  walletCards: WalletCard[];
  extensionInstalled: boolean;
  demoCompleted: boolean;
  onDemoSelect: (merchant: string) => void;
};

export default function FirstTimeOnboarding({
  walletCards,
  extensionInstalled,
  demoCompleted,
  onDemoSelect,
}: FirstTimeOnboardingProps) {
  const walletCardCount = walletCards.length;
  const checks = setupChecksFor({
    walletCardCount,
    extensionInstalled,
    demoCompleted,
  });
  const validation = browserValidationFor({
    walletCardCount,
    extensionInstalled,
  });
  const progress = setupProgress(checks);
  const ready = checks.every((check) => check.status === "complete");

  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <Card className="onboarding-card" variant="hero">
        <div className="onboarding-intro">
          <Badge tone={ready ? "success" : "info"}>
            {ready ? "Ready" : "Setup takes less than a minute"}
          </Badge>
          <div>
            <p className="rw-eyebrow">Welcome to Rewardly</p>
            <h1 id="onboarding-title">
              Rewardly helps you use the best card you already own,
              automatically.
            </h1>
            <p>
              It works at supported online checkout pages. Finish setup, test a
              recommendation, then shop normally.
            </p>
          </div>
        </div>

        <div className="onboarding-grid">
          <section className="setup-panel" aria-labelledby="setup-title">
            <div className="setup-head">
              <div>
                <h2 id="setup-title">Setup checklist</h2>
                <p>{progress}% complete</p>
              </div>
              <span className="setup-progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </span>
            </div>

            <ol className="setup-checklist">
              {checks.map((check) => (
                <li key={check.id} className={`setup-check ${check.status}`}>
                  <span aria-hidden="true">
                    {check.status === "complete" ? "✓" : ""}
                  </span>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.help}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            className="validation-panel"
            aria-labelledby="validation-title"
          >
            <h2 id="validation-title">Browser check</h2>
            <ValidationRow
              label="Extension installed"
              ok={validation.extensionInstalled}
              fix="Install or refresh the Rewardly Chrome Extension."
            />
            <ValidationRow
              label="Signed-in session"
              ok={validation.userSessionReady}
              fix="Open Rewardly from the same browser session."
            />
            <ValidationRow
              label="Wallet available"
              ok={validation.walletAvailable}
              fix="Add your cards to begin receiving recommendations."
            />
            <ValidationRow
              label="Checkout permissions"
              ok={validation.permissionsReady}
              fix="Allow Rewardly on supported checkout pages."
            />
          </section>
        </div>

        <div className="onboarding-actions">
          <section aria-labelledby="demo-title">
            <div className="onboarding-section-head">
              <h2 id="demo-title">Test Rewardly before you shop</h2>
              <p>
                Choose a demo merchant to see the same type of recommendation
                you will get at checkout.
              </p>
            </div>
            <div className="demo-merchant-row">
              {DEMO_MERCHANTS.map((merchant) => (
                <Button
                  key={merchant}
                  type="button"
                  variant="secondary"
                  onClick={() => onDemoSelect(merchant)}
                  aria-label={`Run ${merchant} demo recommendation`}
                >
                  {merchant}
                </Button>
              ))}
            </div>
          </section>

          <section aria-labelledby="merchant-title">
            <div className="onboarding-section-head">
              <h2 id="merchant-title">Where Rewardly appears</h2>
              <p>
                Rewardly activates automatically at supported merchants. More
                merchants are added regularly.
              </p>
            </div>
            <div className="merchant-category-grid">
              {SUPPORTED_MERCHANT_GROUPS.map((group) => (
                <div key={group.category} className="merchant-category">
                  <strong>{group.category}</strong>
                  <p>{group.merchants.join(", ")}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={`ready-panel ${ready ? "complete" : ""}`}>
          <strong>{ready ? "You're ready." : "Finish setup to get ready."}</strong>
          <p>
            {ready
              ? "Rewardly is watching for supported checkout pages and will recommend the best card from your wallet."
              : "Rewardly only recommends cards you own. No card numbers are required."}
          </p>
        </div>
      </Card>
    </section>
  );
}

function ValidationRow({
  label,
  ok,
  fix,
}: {
  label: string;
  ok: boolean;
  fix: string;
}) {
  return (
    <div className={`validation-row ${ok ? "ok" : "attention"}`}>
      <span aria-hidden="true">{ok ? "✓" : "!"}</span>
      <div>
        <strong>{label}</strong>
        <p>{ok ? "Ready" : fix}</p>
      </div>
    </div>
  );
}
