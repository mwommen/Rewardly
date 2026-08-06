import { Badge, Card } from "../../../design-system/components";
import type { PlaygroundScenario, ScenarioId } from "./playgroundModel";

type ScenarioSelectorProps = {
  scenarios: PlaygroundScenario[];
  selectedScenario: ScenarioId;
  onSelect: (scenario: ScenarioId) => void;
};

export default function ScenarioSelector({
  scenarios,
  selectedScenario,
  onSelect,
}: ScenarioSelectorProps) {
  return (
    <div className="playground-scenario-grid">
      {scenarios.map((scenario) => {
        const selected = scenario.id === selectedScenario;
        const available = scenario.status === "available";
        return (
          <button
            type="button"
            className={`playground-scenario ${selected ? "selected" : ""}`.trim()}
            key={scenario.id}
            onClick={() => onSelect(scenario.id)}
            aria-pressed={selected}
          >
            <Card variant={selected ? "hero" : "subtle"}>
              <div className="scenario-icon" aria-hidden="true">
                {scenario.icon}
              </div>
              <div>
                <div className="scenario-head">
                  <strong>{scenario.title}</strong>
                  {!available && <Badge tone="neutral">Coming Soon</Badge>}
                </div>
                <p>{scenario.description}</p>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
