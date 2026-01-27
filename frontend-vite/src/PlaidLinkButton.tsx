// frontend/src/PlaidLinkButton.tsx
import React, { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";

interface PlaidLinkButtonProps {
  onAccessToken: (token: string) => void;
  userId: string;
  apiBase: string;
}

const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({ onAccessToken, userId, apiBase }) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Fetch a link token from the backend
  useEffect(() => {
    fetch(`${apiBase}/api/plaid/create-link-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((res) => res.json())
      .then((data) => {
        setLinkToken(data.link_token);
      })
      .catch((err) => console.error("Failed to get link token:", err));
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
        if (data.access_token) {
          localStorage.setItem("plaid_access_token", data.access_token);
          onAccessToken(data.access_token);
        }
      } catch (err) {
        console.error("Failed to exchange public token:", err);
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
    <button
      onClick={() => open()}
      disabled={!ready || !linkToken}
      style={{
        padding: "10px 20px",
        backgroundColor: "#1976D2",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "bold",
      }}
    >
      Link Credit Cards
    </button>
  );
};

export default PlaidLinkButton;
