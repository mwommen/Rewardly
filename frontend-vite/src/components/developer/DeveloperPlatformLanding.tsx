import { useState } from "react";
import { Badge, Button, Card } from "../../design-system/components";
import DecisionInspector from "./decision-inspector/DecisionInspector";
import DeveloperUseCaseCards, {
  type DeveloperUseCase,
} from "./DeveloperUseCaseCards";
import DecisionPreviewCard from "./DecisionPreviewCard";

const USE_CASES: DeveloperUseCase[] = [
  {
    id: "ai-financial-assistant",
    title: "AI Financial Assistant",
    description:
      "Give your assistant a trusted decision layer for payment recommendations.",
    status: "available",
  },
  {
    id: "digital-wallet",
    title: "Digital Wallet",
    description: "Deliver wallet-aware payment guidance at checkout.",
    status: "soon",
  },
  {
    id: "banking-app",
    title: "Banking App",
    description: "Add explainable financial guidance to everyday money flows.",
    status: "soon",
  },
  {
    id: "personal-finance-app",
    title: "Personal Finance App",
    description: "Help users act on their financial context with confidence.",
    status: "soon",
  },
  {
    id: "travel-rewards-platform",
    title: "Travel Rewards Platform",
    description:
      "Connect rewards, benefits, and protections to trip decisions.",
    status: "soon",
  },
  {
    id: "expense-platform",
    title: "Expense Platform",
    description: "Recommend compliant, wallet-aware payment methods for spend.",
    status: "soon",
  },
  {
    id: "browser-extension",
    title: "Browser Extension",
    description: "Bring trusted payment decisions into browser checkout flows.",
    status: "soon",
  },
  {
    id: "something-else",
    title: "Something Else",
    description:
      "Explore Rewardly as a financial decision infrastructure layer.",
    status: "soon",
  },
];

const TRUST_QUESTIONS = [
  "Why?",
  "Based on what evidence?",
  "How confident are we?",
  "What alternatives were considered?",
  "Can this decision be replayed?",
];

export default function DeveloperPlatformLanding() {
  const [selectedUseCase, setSelectedUseCase] = useState(USE_CASES[0].id);
  const activeUseCase = USE_CASES.find(
    (useCase) => useCase.id === selectedUseCase,
  );
  const aiPathSelected = selectedUseCase === "ai-financial-assistant";
  const scrollToInspector = () => {
    document
      .getElementById("decision-inspector")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="developer-shell">
      <section
        className="developer-hero"
        aria-labelledby="developer-hero-title"
      >
        <div className="developer-hero-copy">
          <Badge tone="info">Financial Decision Infrastructure</Badge>
          <h1 id="developer-hero-title">
            Build the financial product your users will trust.
          </h1>
          <div className="developer-hero-text">
            <p>
              Rewardly gives your application explainable, evidence-backed
              financial decision intelligence through a single API.
            </p>
            <p>
              Start with one trusted payment decision. Scale into a complete
              financial decision layer.
            </p>
          </div>
          <div className="developer-hero-actions" aria-label="Primary actions">
            <Button
              variant="primary"
              onClick={() =>
                document
                  .getElementById("first-trusted-decision")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              Start Building
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                document
                  .getElementById("decision-preview")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              See Live Demo
            </Button>
          </div>
        </div>

        <DecisionPreviewCard compact />
      </section>

      <section className="developer-section" aria-labelledby="use-case-title">
        <div className="developer-section-head">
          <p className="rw-eyebrow">Start With The Job</p>
          <h2 id="use-case-title">What are you building?</h2>
        </div>
        <DeveloperUseCaseCards
          useCases={USE_CASES}
          selectedUseCase={selectedUseCase}
          onSelect={setSelectedUseCase}
        />
      </section>

      <section
        id="first-trusted-decision"
        className="developer-section ai-path-section"
        aria-labelledby="ai-path-title"
      >
        <div className="developer-section-head narrow">
          <p className="rw-eyebrow">{activeUseCase?.title}</p>
          <h2 id="ai-path-title">
            {aiPathSelected
              ? "Build trustworthy payment recommendations into your AI assistant."
              : "Coming soon."}
          </h2>
          {!aiPathSelected && (
            <p>
              This path will use the same decision infrastructure once the
              workflow is ready.
            </p>
          )}
        </div>

        {aiPathSelected && (
          <div className="ai-flow-grid">
            <Card variant="subtle" className="ai-flow-card">
              <span className="flow-label">Before Rewardly</span>
              <div className="flow-stack" aria-label="Before Rewardly flow">
                <FlowNode title="User" detail="Which card should I use?" />
                <FlowArrow />
                <FlowNode
                  title="LLM"
                  detail="General answer without evidence"
                />
                <FlowArrow />
                <FlowNode
                  title="Uncertain answer"
                  detail="Hard to validate or replay"
                />
              </div>
            </Card>

            <Card variant="hero" className="ai-flow-card ai-flow-card-after">
              <span className="flow-label">After Rewardly</span>
              <div className="flow-stack" aria-label="After Rewardly flow">
                <FlowNode title="User" detail="What should I use?" />
                <FlowArrow />
                <FlowNode
                  title="Rewardly Decision Platform"
                  detail="Evidence, confidence, alternatives"
                />
                <FlowArrow />
                <FlowNode
                  title="LLM"
                  detail="Turns decision into the user answer"
                />
                <FlowArrow />
                <FlowNode
                  title="Trusted recommendation"
                  detail="Explainable and replayable"
                />
              </div>
            </Card>
          </div>
        )}
      </section>

      <section
        className="developer-section trust-callout"
        aria-labelledby="trust-title"
      >
        <Card variant="flat" className="trust-callout-inner">
          <div>
            <p className="rw-eyebrow">Trust Layer</p>
            <h2 id="trust-title">Every recommendation should answer:</h2>
          </div>
          <div className="trust-question-grid">
            {TRUST_QUESTIONS.map((question) => (
              <div className="trust-question" key={question}>
                <span aria-hidden="true">✓</span>
                <strong>{question}</strong>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section
        id="decision-preview"
        className="developer-section decision-preview-section"
        aria-labelledby="decision-preview-title"
      >
        <div className="developer-section-head narrow">
          <p className="rw-eyebrow">First Trusted Decision</p>
          <h2 id="decision-preview-title">See Rewardly make a decision.</h2>
          <p>
            A simple preview of the decision contract a developer can build
            against.
          </p>
        </div>
        <DecisionPreviewCard onInspect={scrollToInspector} />
      </section>

      <DecisionInspector />
    </main>
  );
}

function FlowNode({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flow-node">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function FlowArrow() {
  return (
    <span className="flow-arrow" aria-hidden="true">
      ↓
    </span>
  );
}
