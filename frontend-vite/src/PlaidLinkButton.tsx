// frontend/src/PlaidLinkButton.tsx
import React, { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { trackEvent } from "./lib/analytics";

interface PlaidLinkButtonProps {
  onAccessToken: (token: string) => void;
  userId: string;
  apiBase: string;
  className?: string;
  label?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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
    trackEvent("plaid_link_init", { userId });
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
        trackEvent("plaid_link_error", {
          stage: "create_link_token",
          message: err?.message || "unknown",
        });
        setLoading(false);
      });
  }, [apiBase, userId, onError]);

  const { open, ready } = usePlaidLink({
    token: linkToken || "",
    onSuccess: async (public_token: string) => {
      try {
        trackEvent("plaid_link_success", { stage: "onSuccess" });
        console.log("[Plaid] onSuccess public_token", public_token);
        const res = await fetch(`${apiBase}/api/plaid/exchange-public-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, userId }),
        });
        const data = await res.json();
        console.log("[Plaid] exchange response", data);
        if (res.ok && (data?.ok || data?.linked || data?.access_token)) {
          trackEvent("plaid_link_exchange", {
            status: "ok",
            itemId: data?.linked?.itemId,
          });
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
          trackEvent("plaid_link_exchange", {
            status: "error",
            error: data?.error,
          });
          onError?.(data?.error || "Link failed. Please try again.");
        }
      } catch (err) {
        console.error("Failed to exchange public token:", err);
        trackEvent("plaid_link_error", {
          stage: "exchange_public_token",
          message: getErrorMessage(err, "unknown"),
        });
        onError?.("Link failed. Please try again.");
      }
    },
    onEvent: (eventName, metadata) => {
      console.log("[Plaid] event", eventName, metadata);
      trackEvent("plaid_link_event", { eventName, metadata });
    },
    onExit: (err, metadata) => {
      if (err) console.error("[Plaid] exit error", err, metadata);
      else console.log("[Plaid] exit", metadata);
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready || !linkToken || loading}
      className={className}
    >
      {loading ? "Preparing…" : label || "Link Credit Cards"}
    </button>
  );
};

export default PlaidLinkButton;
