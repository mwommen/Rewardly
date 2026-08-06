import MerchantPicker from "./MerchantPicker";
import type { PlaygroundMerchant, PlaygroundPurchase } from "./playgroundModel";

type PurchaseConfiguratorProps = {
  merchants: PlaygroundMerchant[];
  purchase: PlaygroundPurchase;
  onChange: (purchase: PlaygroundPurchase) => void;
  useSlider?: boolean;
};

export default function PurchaseConfigurator({
  merchants,
  purchase,
  onChange,
  useSlider = false,
}: PurchaseConfiguratorProps) {
  const amount = Number(purchase.amount) || 5;

  return (
    <div className="playground-form-grid">
      <MerchantPicker
        merchants={merchants}
        merchantId={purchase.merchantId}
        onChange={(merchantId) => onChange({ ...purchase, merchantId })}
      />
      <label className="playground-field">
        <span>Purchase Amount</span>
        {useSlider ? (
          <div className="amount-slider-control">
            <strong>${amount.toLocaleString()}</strong>
            <input
              type="range"
              min="5"
              max="2500"
              step="5"
              value={amount}
              onChange={(event) =>
                onChange({
                  ...purchase,
                  amount: Number(event.target.value).toFixed(2),
                })
              }
            />
          </div>
        ) : (
          <input
            type="number"
            min="0"
            step="0.01"
            value={purchase.amount}
            onChange={(event) =>
              onChange({ ...purchase, amount: event.target.value })
            }
          />
        )}
      </label>
      <label className="playground-field">
        <span>Currency</span>
        <select
          value={purchase.currency}
          onChange={() => onChange({ ...purchase, currency: "USD" })}
        >
          <option value="USD">USD</option>
        </select>
      </label>
    </div>
  );
}
