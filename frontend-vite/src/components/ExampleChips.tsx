import { Button } from "../design-system/components";

type ExampleChipsProps = {
  examples: string[];
  onSelect: (example: string) => void;
};

export default function ExampleChips({
  examples,
  onSelect,
}: ExampleChipsProps) {
  return (
    <div className="example-row" aria-label="Example searches">
      {examples.map((example) => (
        <Button
          key={example}
          type="button"
          variant="secondary"
          onClick={() => onSelect(example)}
          aria-label={`Search ${example}`}
        >
          {example}
        </Button>
      ))}
    </div>
  );
}
