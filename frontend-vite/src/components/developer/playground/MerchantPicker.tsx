import type { PlaygroundMerchant } from "./playgroundModel";

type MerchantPickerProps = {
  merchants: PlaygroundMerchant[];
  merchantId: string;
  onChange: (merchantId: string) => void;
};

export default function MerchantPicker({
  merchants,
  merchantId,
  onChange,
}: MerchantPickerProps) {
  return (
    <label className="playground-field">
      <span>Merchant</span>
      <select
        value={merchantId}
        onChange={(event) => onChange(event.target.value)}
      >
        {merchants.map((merchant) => (
          <option value={merchant.id} key={merchant.id}>
            {merchant.name}
          </option>
        ))}
      </select>
    </label>
  );
}
