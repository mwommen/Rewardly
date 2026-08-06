import { Card } from "../../../design-system/components";
import type {
  PlaygroundCard,
  PlaygroundMerchant,
  PlaygroundPurchase,
  PlaygroundPurchaseContext,
} from "./playgroundModel";
import PurchaseConfigurator from "./PurchaseConfigurator";
import WalletConfigurator from "./WalletConfigurator";

type InputConfiguratorProps = {
  merchants: PlaygroundMerchant[];
  purchase: PlaygroundPurchase;
  context: PlaygroundPurchaseContext;
  wallet: PlaygroundCard[];
  onPurchaseChange: (purchase: PlaygroundPurchase) => void;
  onContextChange: (context: PlaygroundPurchaseContext) => void;
  onWalletChange: (cards: PlaygroundCard[]) => void;
};

export default function InputConfigurator({
  merchants,
  purchase,
  context,
  wallet,
  onPurchaseChange,
  onContextChange,
  onWalletChange,
}: InputConfiguratorProps) {
  return (
    <Card variant="default" className="evolution-input-panel">
      <div className="playground-step-head">
        <span>Live Inputs</span>
        <h3>Decision inputs</h3>
      </div>

      <PurchaseConfigurator
        merchants={merchants}
        purchase={purchase}
        onChange={onPurchaseChange}
        useSlider
      />

      <div className="context-control-grid">
        <label className="playground-field">
          <span>Purchase Type</span>
          <select
            value={context.purchaseType}
            onChange={(event) =>
              onContextChange({
                ...context,
                purchaseType: event.target
                  .value as PlaygroundPurchaseContext["purchaseType"],
              })
            }
          >
            <option value="in_store">In Store</option>
            <option value="online">Online</option>
            <option value="travel">Travel</option>
            <option value="dining">Dining</option>
          </select>
        </label>

        <ContextToggle
          label="Business Expense"
          checked={context.businessExpense}
          onChange={(businessExpense) =>
            onContextChange({ ...context, businessExpense })
          }
        />
        <ContextToggle
          label="Subscription"
          checked={context.subscription}
          onChange={(subscription) =>
            onContextChange({ ...context, subscription })
          }
        />
        <ContextToggle
          label="Large Purchase"
          checked={context.largePurchase}
          onChange={(largePurchase) =>
            onContextChange({ ...context, largePurchase })
          }
        />
      </div>

      <WalletConfigurator cards={wallet} onChange={onWalletChange} compact />
    </Card>
  );
}

function ContextToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="context-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
      <strong>{checked ? "On" : "Off"}</strong>
    </label>
  );
}
