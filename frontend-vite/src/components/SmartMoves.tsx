import { Button, SectionHeader } from "../design-system/components";

export type SmartMove = {
  icon: string;
  title: string;
  text: string;
  query: string;
};

type SmartMovesProps = {
  moves: SmartMove[];
  onSelect: (query: string) => void;
};

export default function SmartMoves({ moves, onSelect }: SmartMovesProps) {
  return (
    <section className="smart-moves" aria-label="Today's smart moves">
      <SectionHeader title="Today's smart moves" />
      <div className="smart-move-grid">
        {moves.map((move) => (
          <Button
            key={move.title}
            type="button"
            variant="secondary"
            onClick={() => onSelect(move.query)}
            aria-label={`Search ${move.title}`}
          >
            <span className="smart-icon" aria-hidden="true">{move.icon}</span>
            <strong>{move.title}</strong>
            <span>{move.text}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}
