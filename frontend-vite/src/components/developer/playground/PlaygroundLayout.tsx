import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../../../design-system/components";
import DecisionInspector from "../decision-inspector/DecisionInspector";
import ApiCodeTabs from "./ApiCodeTabs";
import DecisionComparisonTable from "./DecisionComparisonTable";
import DecisionDiffViewer from "./DecisionDiffViewer";
import DecisionHistory from "./DecisionHistory";
import InputConfigurator from "./InputConfigurator";
import LiveDecisionPanel from "./LiveDecisionPanel";
import {
  createPlaygroundDecision,
  DEFAULT_PLAYGROUND_CONTEXT,
  DEFAULT_PLAYGROUND_WALLET,
  PLAYGROUND_MERCHANTS,
  PLAYGROUND_SCENARIOS,
  type PlaygroundCard,
  type PlaygroundDecision,
  type PlaygroundDecisionHistoryItem,
  type PlaygroundPurchase,
  type PlaygroundPurchaseContext,
  type ScenarioId,
} from "./playgroundModel";
import { createHistoryItem, getChangeTrigger } from "./PlaygroundStateManager";
import RecommendationEvolutionTimeline from "./RecommendationEvolutionTimeline";
import RuleTracePanel from "./RuleTracePanel";
import ScenarioSelector from "./ScenarioSelector";

type ExploreTab = "inspector" | "request" | "response" | "evidence";

const EXPLORE_TABS: { id: ExploreTab; label: string }[] = [
  { id: "inspector", label: "Decision Inspector" },
  { id: "request", label: "API Request" },
  { id: "response", label: "API Response" },
  { id: "evidence", label: "Evidence JSON" },
];

export default function PlaygroundLayout() {
  const [scenario, setScenario] = useState<ScenarioId>("retail");
  const [purchase, setPurchase] = useState<PlaygroundPurchase>({
    merchantId: "target",
    amount: "146.00",
    currency: "USD",
  });
  const [context, setContext] = useState<PlaygroundPurchaseContext>(
    DEFAULT_PLAYGROUND_CONTEXT,
  );
  const [wallet, setWallet] = useState<PlaygroundCard[]>(
    DEFAULT_PLAYGROUND_WALLET,
  );
  const [decision, setDecision] = useState<PlaygroundDecision>(() =>
    createPlaygroundDecision(
      { merchantId: "target", amount: "146.00", currency: "USD" },
      DEFAULT_PLAYGROUND_WALLET,
      DEFAULT_PLAYGROUND_CONTEXT,
    ),
  );
  const [history, setHistory] = useState<PlaygroundDecisionHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [comparisonAId, setComparisonAId] = useState("");
  const [comparisonBId, setComparisonBId] = useState("");
  const [activeTab, setActiveTab] = useState<ExploreTab>("inspector");
  const previousHistoryRef = useRef<PlaygroundDecisionHistoryItem | null>(null);

  useEffect(() => {
    const nextDecision = createPlaygroundDecision(purchase, wallet, context);
    setDecision(nextDecision);
    setHistory((current) => {
      const trigger = getChangeTrigger(
        previousHistoryRef.current,
        purchase,
        context,
        wallet,
      );
      const nextItem = createHistoryItem({
        sequence: current.length + 1,
        trigger,
        decision: nextDecision,
        purchase,
        context,
        wallet,
        previous: previousHistoryRef.current,
      });
      previousHistoryRef.current = nextItem;
      setSelectedHistoryId(nextItem.id);
      setComparisonBId(nextItem.id);
      setComparisonAId((currentId) => currentId || nextItem.id);
      return [...current, nextItem].slice(-8);
    });
  }, [context, purchase, wallet]);

  const selectedHistory = useMemo(
    () =>
      history.find((item) => item.id === selectedHistoryId) ??
      history[history.length - 1],
    [history, selectedHistoryId],
  );
  const comparisonA = useMemo(
    () => history.find((item) => item.id === comparisonAId) ?? history[0],
    [comparisonAId, history],
  );
  const comparisonB = useMemo(
    () =>
      history.find((item) => item.id === comparisonBId) ??
      history[history.length - 1],
    [comparisonBId, history],
  );

  const inspectedDecision = selectedHistory?.decision ?? decision;
  const activePayload = inspectedDecision
    ? {
        request: inspectedDecision.api.request,
        response: inspectedDecision.api.response,
        evidence: inspectedDecision.api.evidence,
      }[activeTab as Exclude<ExploreTab, "inspector">]
    : null;

  return (
    <section
      id="developer-playground"
      className="developer-section playground-section"
      aria-labelledby="playground-title"
    >
      <div className="developer-section-head narrow">
        <p className="rw-eyebrow">Interactive Playground</p>
        <h2 id="playground-title">
          Watch a financial decision evolve in real time.
        </h2>
        <p>
          Change the merchant, purchase, wallet, or context and see Rewardly
          update the recommendation, evidence, confidence, and API examples.
        </p>
      </div>

      <div className="evolution-workspace">
        <InputConfigurator
          merchants={PLAYGROUND_MERCHANTS}
          purchase={purchase}
          context={context}
          wallet={wallet}
          onPurchaseChange={setPurchase}
          onContextChange={setContext}
          onWalletChange={setWallet}
        />

        <div className="evolution-center-panel">
          <LiveDecisionPanel decision={decision} />
          <RuleTracePanel decision={decision} />
        </div>

        <div className="evolution-side-panel">
          <RecommendationEvolutionTimeline
            history={history}
            selectedId={selectedHistoryId}
            onSelect={setSelectedHistoryId}
          />
          <DecisionHistory
            history={history}
            selectedId={selectedHistoryId}
            onSelect={setSelectedHistoryId}
          />
        </div>
      </div>

      <Card variant="default" className="playground-panel scenario-strip">
        <div className="playground-step">
          <div className="playground-step-head">
            <span>Scenario</span>
            <h3>Choose a sample scenario</h3>
          </div>
          <ScenarioSelector
            scenarios={PLAYGROUND_SCENARIOS}
            selectedScenario={scenario}
            onSelect={setScenario}
          />
        </div>
      </Card>

      {comparisonA && comparisonB && (
        <div className="comparison-workspace">
          <div className="comparison-selectors">
            <label className="playground-field">
              <span>Decision A</span>
              <select
                value={comparisonA.id}
                onChange={(event) => setComparisonAId(event.target.value)}
              >
                {history.map((item) => (
                  <option value={item.id} key={item.id}>
                    Decision {item.sequence}:{" "}
                    {item.decision.recommendation.cardName}
                  </option>
                ))}
              </select>
            </label>
            <label className="playground-field">
              <span>Decision B</span>
              <select
                value={comparisonB.id}
                onChange={(event) => setComparisonBId(event.target.value)}
              >
                {history.map((item) => (
                  <option value={item.id} key={item.id}>
                    Decision {item.sequence}:{" "}
                    {item.decision.recommendation.cardName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DecisionComparisonTable
            decisionA={comparisonA}
            decisionB={comparisonB}
          />
          {selectedHistory && <DecisionDiffViewer decision={selectedHistory} />}
        </div>
      )}

      <div className="playground-explore">
        <div className="json-tabs" role="tablist" aria-label="Explore decision">
          {EXPLORE_TABS.map((tab) => (
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

        {activeTab === "inspector" ? (
          <DecisionInspector decision={inspectedDecision} compactHeading />
        ) : (
          <Card variant="default" className="inspector-panel json-viewer">
            <pre className="json-code">
              <code>{JSON.stringify(activePayload, null, 2)}</code>
            </pre>
          </Card>
        )}
      </div>

      <ApiCodeTabs decision={inspectedDecision} />
    </section>
  );
}
