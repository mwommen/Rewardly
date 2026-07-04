import type { Card as WalletCard } from "../cardModules";
import {
  Badge,
  Card,
  EmptyState,
  SectionHeader,
} from "../design-system/components";
import { getCardLogo } from "../lib/cardLogos";
import { walletSections } from "../lib/walletSections";
import LogoMark from "./LogoMark";

type WalletPreviewProps = {
  walletCards: WalletCard[];
  selectedWalletCard?: WalletCard;
  onSelect: (key: string) => void;
};

export default function WalletPreview({
  walletCards,
  selectedWalletCard,
  onSelect,
}: WalletPreviewProps) {
  return (
    <section className="wallet-section" aria-label="Wallet">
      <SectionHeader
        eyebrow="Wallet"
        title="Your cards, organized for decisions."
        action={<Badge tone="info">{walletCards.length || "Demo"} cards</Badge>}
      />
      <div className="wallet-layout">
        <div className="wallet-stack" aria-label="Wallet cards">
          {walletCards.slice(0, 5).map((card, index) => {
            const key = card.slug || card.name;
            const selected =
              key === (selectedWalletCard?.slug || selectedWalletCard?.name);
            return (
              <button
                key={key}
                type="button"
                className={`wallet-card ${selected ? "selected" : ""}`}
                style={{ transform: `translateY(${index * -18}px)` }}
                onClick={() => onSelect(key)}
                aria-label={`Open ${card.name}`}
              >
                <span>{card.issuer}</span>
                <strong>{card.name}</strong>
                <LogoMark src={getCardLogo(card)} label={card.name} />
              </button>
            );
          })}
        </div>

        <Card className="wallet-detail" variant="subtle">
          {selectedWalletCard ? (
            <>
              <div className="wallet-detail-head">
                <div className="card-logo-tile">
                  <LogoMark
                    src={getCardLogo(selectedWalletCard)}
                    label={selectedWalletCard.name}
                  />
                </div>
                <div>
                  <p className="recommendation-label">In your wallet</p>
                  <h2>{selectedWalletCard.name}</h2>
                  <p>{selectedWalletCard.issuer}</p>
                </div>
              </div>
              <div className="wallet-detail-grid">
                {walletSections(selectedWalletCard).map((section) => (
                  <section key={section.title}>
                    <h3>{section.title}</h3>
                    <ul>
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No wallet cards yet.">
              Link cards or seed demo data to see a wallet-style card stack.
            </EmptyState>
          )}
        </Card>
      </div>
    </section>
  );
}
