import { useEffect } from "react";
import MapLinkedAccounts from "./MapLinkedAccounts";

export default function LinkedAccountsReview({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="linked-review-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="linked-review-modal">
        <div className="linked-review-head">
          <div>
            <strong>Review linked accounts</strong>
            <p>Confirm or correct how Plaid matched your cards.</p>
          </div>
          <button type="button" className="linked-review-close" onClick={onClose}>
            Close
          </button>
        </div>
        <MapLinkedAccounts userId={userId} onChanged={onChanged} />
      </div>
    </div>
  );
}
