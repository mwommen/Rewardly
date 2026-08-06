import { useMemo, useState } from "react";
import { Button, Card } from "../../../design-system/components";
import type { PlaygroundDecision } from "./playgroundModel";

type CodeTab = "typescript" | "python" | "curl";

const TABS: { id: CodeTab; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "curl", label: "cURL" },
];

type ApiCodeTabsProps = {
  decision: PlaygroundDecision | null;
};

export default function ApiCodeTabs({ decision }: ApiCodeTabsProps) {
  const [activeTab, setActiveTab] = useState<CodeTab>("typescript");
  const [copied, setCopied] = useState(false);
  const request = decision?.api.request;

  const code = useMemo(() => {
    if (!request)
      return "Generate a trusted decision to create integration code.";
    const body = JSON.stringify(request, null, 2);

    if (activeTab === "python") {
      return `decision = client.payment_decisions.create(${body})`;
    }

    if (activeTab === "curl") {
      return `curl https://api.rewardly.dev/api/v1/payment-decisions \\
  -H "Authorization: Bearer $REWARDLY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${body.replaceAll("'", "'\\''")}'`;
    }

    return `const decision = await rewardly.paymentDecisions.create(${body});`;
  }, [activeTab, request]);

  const copyCode = async () => {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Card variant="default" className="inspector-panel api-code-tabs">
      <div className="json-viewer-head">
        <div>
          <p className="rw-eyebrow">Integrate</p>
          <h3>Use the exact decision request in your app</h3>
        </div>
        <Button variant="secondary" onClick={copyCode} disabled={!decision}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="json-tabs" role="tablist" aria-label="SDK examples">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <pre className="json-code">
        <code>{code}</code>
      </pre>
    </Card>
  );
}
