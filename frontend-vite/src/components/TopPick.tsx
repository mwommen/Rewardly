type TopPickProps = {
  name: string;
  rate?: number;
  explainer?: string;
  confidence?: number;
};

export default function TopPick({ name, rate, explainer, confidence }: TopPickProps) {
  const confVal =
    confidence == null ? undefined : confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fafafa",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: 0.6, color: "#6b7280", marginBottom: 6 }}>TOP PICK</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{name}</div>
      <div style={{ marginTop: 6, fontSize: 14 }}>
        Effective rate: <strong>{rate != null ? `${rate.toFixed(2)}%` : "—"}</strong>
        {confVal != null && <span style={{ color: "#6b7280" }}> (confidence {confVal}%)</span>}
      </div>
      {explainer && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#374151", lineHeight: 1.4 }}>{explainer}</div>
      )}
    </div>
  );
}
