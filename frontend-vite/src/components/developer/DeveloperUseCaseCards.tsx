import { Badge, Card } from "../../design-system/components";

export type DeveloperUseCase = {
  id: string;
  title: string;
  description: string;
  status: "available" | "soon";
};

type DeveloperUseCaseCardsProps = {
  useCases: DeveloperUseCase[];
  selectedUseCase: string;
  onSelect: (id: string) => void;
};

export default function DeveloperUseCaseCards({
  useCases,
  selectedUseCase,
  onSelect,
}: DeveloperUseCaseCardsProps) {
  return (
    <div className="developer-use-case-grid">
      {useCases.map((useCase) => {
        const selected = selectedUseCase === useCase.id;
        const available = useCase.status === "available";

        return (
          <button
            className={`developer-use-case ${selected ? "selected" : ""}`.trim()}
            key={useCase.id}
            type="button"
            onClick={() => onSelect(useCase.id)}
            aria-pressed={selected}
          >
            <Card variant={selected ? "hero" : "subtle"}>
              <div className="developer-use-case-head">
                <strong>{useCase.title}</strong>
                {!available && <Badge tone="neutral">Coming Soon</Badge>}
              </div>
              <p>{useCase.description}</p>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
