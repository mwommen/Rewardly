type OfferItem = {
  card: { slug: string; name: string };
  signupOffer?: string | null;
  perks?: string[];
};

type Props = { items: OfferItem[] };

export default function OffersList({ items }: Props) {
  if (!items?.length) {
    return (
      <div style={{ fontSize: 14, color: "#6b7280" }}>
        No current offers or perks matched this merchant/MCC.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((o) => (
        <div
          key={o.card.slug}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 12,
            background: "white",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{o.card.name}</div>
          {o.signupOffer && (
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Signup Offer:</span> {o.signupOffer}
            </div>
          )}
          {o.perks?.length ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {o.perks.map((p, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.4 }}>
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: 13, color: "#6b7280" }}>No listed ongoing perks.</div>
          )}
        </div>
      ))}
    </div>
  );
}
