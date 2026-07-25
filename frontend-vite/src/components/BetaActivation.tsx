import { useEffect, useState, type FormEvent } from "react";
import {
  activateBetaSession,
  clearBetaSession,
  createExtensionConnectionCode,
  loadBetaWallet,
  readBetaSession,
  verifyBetaSession,
  type BetaSession,
} from "../lib/betaSession";

export default function BetaActivation() {
  const [session, setSession] = useState<BetaSession | null>(() =>
    readBetaSession(),
  );
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "checking" | "activating" | "active" | "error"
  >(session ? "checking" : "idle");
  const [message, setMessage] = useState(
    session ? "Checking your beta access..." : "",
  );
  const [connectionCode, setConnectionCode] = useState("");
  const [walletCount, setWalletCount] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    verifyBetaSession()
      .then(() => loadBetaWallet())
      .then((data) => {
        if (cancelled) return;
        setStatus("active");
        setWalletCount(
          Array.isArray(data?.wallet?.cardSlugs)
            ? data.wallet.cardSlugs.length
            : 0,
        );
        setMessage("Rewardly beta access is active.");
      })
      .catch((error) => {
        if (cancelled) return;
        setSession(null);
        setStatus("error");
        setMessage(error?.message || "Rewardly beta access has expired.");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Enter your Rewardly activation code.");
      return;
    }

    setStatus("activating");
    setMessage("Activating Rewardly...");
    try {
      const activated = await activateBetaSession(trimmed);
      setCode("");
      setSession(activated);
      setStatus("active");
      setMessage("Rewardly beta access is active.");
    } catch (error: unknown) {
      const messageText =
        error instanceof Error ? error.message : "Activation failed.";
      setStatus("error");
      setMessage(
        /invite|invalid|expired|used|revoked/i.test(messageText)
          ? "That activation code is invalid, expired, already used, or revoked."
          : "Rewardly could not activate right now. Try again shortly.",
      );
    }
  };

  const createConnection = async () => {
    setMessage("Creating extension connection code...");
    try {
      const connection = await createExtensionConnectionCode();
      setConnectionCode(connection.connectionCode);
      setMessage("Enter this one-time code in the Rewardly extension popup.");
    } catch {
      setMessage("Rewardly could not create a connection code. Try again.");
    }
  };

  const logout = () => {
    clearBetaSession();
    setSession(null);
    setConnectionCode("");
    setWalletCount(null);
    setStatus("idle");
    setMessage("");
  };

  return (
    <section className="beta-activation" aria-labelledby="beta-title">
      <div>
        <p className="beta-eyebrow">Private beta</p>
        <h2 id="beta-title">Activate Rewardly</h2>
        <p>
          Enter your invitation code once. Rewardly will keep your beta session
          on this browser and let you connect the Chrome extension.
        </p>
      </div>

      {!session ? (
        <form className="beta-form" onSubmit={submit}>
          <input
            aria-label="Rewardly activation code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Activation code"
            autoComplete="one-time-code"
          />
          <button type="submit" disabled={status === "activating"}>
            {status === "activating" ? "Activating..." : "Activate"}
          </button>
        </form>
      ) : (
        <div className="beta-active-card">
          <div>
            <strong>Rewardly is connected on this browser.</strong>
            <span>
              {walletCount === null
                ? "Loading wallet..."
                : `${walletCount} card${walletCount === 1 ? "" : "s"} in your wallet`}
            </span>
          </div>
          <div className="beta-actions">
            <button type="button" onClick={createConnection}>
              Connect Rewardly Extension
            </button>
            <button type="button" className="secondary" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      )}

      {connectionCode ? (
        <div className="connection-code" role="status">
          <span>One-time extension code</span>
          <strong>{connectionCode}</strong>
          <p>Expires in about five minutes and can be used once.</p>
        </div>
      ) : null}

      {message ? (
        <p className={`beta-message ${status === "error" ? "error" : ""}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
