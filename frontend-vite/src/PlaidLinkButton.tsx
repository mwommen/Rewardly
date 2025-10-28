// frontend/src/PlaidLinkButton.tsx
import React, { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";

interface PlaidLinkButtonProps {
  onAccessToken: (token: string) => void;
}

const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({ onAccessToken }) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Fetch a link token from the backend
  useEffect(() => {
    fetch("http://localhost:5001/api/plaid/create-link-token", {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        setLinkToken(data.link_token);
      })
      .catch((err) => console.error("Failed to get link token:", err));
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken || "",
    onSuccess: async (public_token: string) => {
      try {
        const res = await fetch("http://localhost:5001/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem("plaid_access_token", data.access_token);
          onAccessToken(data.access_token);
        }
      } catch (err) {
        console.error("Failed to exchange public token:", err);
      }
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
      Link Bank Account
    </button>
  );
};

export default PlaidLinkButton;
