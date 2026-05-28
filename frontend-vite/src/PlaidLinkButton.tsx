// frontend/src/PlaidLinkButton.tsx
import React, { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";

interface PlaidLinkButtonProps {
  onAccessToken: (token: string) => void;
  userId: string;
  apiBase: string;
  className?: string;
  label?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({
  onAccessToken,
  userId,
  apiBase,
  className,
  label,
  onSuccess,
  onError,
}) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch a link token from the backend
  useEffect(() => {
    setLoading(true);
    fetch(`${apiBase}/api/plaid/create-link-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((res) => res.json())
      .then((data) => {
        setLinkToken(data.link_token);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to get link token:", err);
        onError?.("Unable to start Plaid. Please try again.");
        setLoading(false);
      });
  }, [apiBase, userId]);

  const { open, ready } = usePlaidLink({
    token: linkToken || "",
    onSuccess: async (public_token: string) => {
      try {
        console.log("[Plaid] onSuccess public_token", public_token);
        const res = await fetch(`${apiBase}/api/plaid/exchange-public-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, userId }),
        });
        const data = await res.json();
        console.log("[Plaid] exchange response", data);
        if (res.ok && (data?.ok || data?.linked || data?.access_token)) {
          const callbackValue =
            typeof data?.access_token === "string"
              ? data.access_token
              : typeof data?.linked?.itemId === "string"
              ? data.linked.itemId
              : "linked";
          if (typeof data?.access_token === "string") {
            localStorage.setItem("plaid_access_token", data.access_token);
          }
          onAccessToken(callbackValue);
          onSuccess?.();
        } else {
          onError?.(data?.error || "Link failed. Please try again.");
        }
      } catch (err) {
        console.error("Failed to exchange public token:", err);
        onError?.("Link failed. Please try again.");
      }
    },
    onEvent: (eventName, metadata) => {
      console.log("[Plaid] event", eventName, metadata);
    },
    onExit: (err, metadata) => {
      if (err) console.error("[Plaid] exit error", err, metadata);
      else console.log("[Plaid] exit", metadata);
    },
  });

  return (
    <button onClick={() => open()} disabled={!ready || !linkToken || loading} className={className}>
      {loading ? "Preparing…" : label || "Link Credit Cards"}
    </button>
  );
};

export default PlaidLinkButton;
