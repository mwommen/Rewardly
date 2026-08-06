import { useMemo, useState } from "react";
import { Button, Card } from "../../../design-system/components";

type JsonViewerProps = {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  evidence: Record<string, unknown>;
};

type JsonTab = "request" | "response" | "evidence";

const TABS: { id: JsonTab; label: string }[] = [
  { id: "request", label: "Request" },
  { id: "response", label: "Response" },
  { id: "evidence", label: "Evidence" },
];

export default function JsonViewer({
  request,
  response,
  evidence,
}: JsonViewerProps) {
  const [activeTab, setActiveTab] = useState<JsonTab>("request");
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const payload = useMemo(() => {
    const data = { request, response, evidence }[activeTab];
    return JSON.stringify(data, null, 2);
  }, [activeTab, evidence, request, response]);

  const copyPayload = async () => {
    await navigator.clipboard?.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Card variant="default" className="inspector-panel json-viewer">
      <div className="json-viewer-head">
        <div>
          <p className="rw-eyebrow">API View</p>
          <h3>Inspect the raw decision contract</h3>
        </div>
        <div className="json-actions">
          <Button
            variant="ghost"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Collapse" : "Expand"}
          </Button>
          <Button variant="secondary" onClick={copyPayload}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className="json-tabs" role="tablist" aria-label="Decision JSON">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {expanded && (
        <pre className="json-code" aria-label={`${activeTab} JSON`}>
          <code>{payload}</code>
        </pre>
      )}
    </Card>
  );
}
