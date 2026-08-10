type V1ErrorCode = "INVALID_REQUEST" | "UNSUPPORTED_PURCHASE" | "ENGINE_FAILURE";

type RequestValidationResult =
  | { ok: true; value: NormalizedV1PaymentDecisionRequest }
  | { ok: false; status: number; code: V1ErrorCode; message: string };

export type NormalizedV1PaymentDecisionRequest = {
  merchant: {
    name: string;
    category?: string;
    domain?: string;
    mcc?: string;
  };
  purchase: {
    amount: number;
    currency: "USD";
  };
  wallet: {
    cards: Array<{ cardId: string }>;
  };
  context?: Record<string, unknown>;
};

export function validatePaymentDecisionRequest(
  body: any,
): RequestValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("request body must be an object");
  }
  const topLevelError = unknownKeys(
    body,
    ["merchant", "purchase", "wallet", "context"],
    "request",
  );
  if (topLevelError) return invalid(topLevelError);
  if (
    body.context !== undefined &&
    (!body.context ||
      typeof body.context !== "object" ||
      Array.isArray(body.context))
  ) {
    return invalid("context must be an object when supplied");
  }

  if (!body.merchant || typeof body.merchant !== "object") {
    return invalid("merchant is required");
  }
  if (Array.isArray(body.merchant))
    return invalid("merchant must be an object");
  const merchantKeyError = unknownKeys(
    body.merchant,
    ["name", "category", "domain", "mcc"],
    "merchant",
  );
  if (merchantKeyError) return invalid(merchantKeyError);
  const merchantName = cleanString(body.merchant.name);
  if (!merchantName) return invalid("merchant.name is required");
  if (merchantName.length > 160) {
    return invalid("merchant.name must be 160 characters or fewer");
  }

  if (!body.purchase || typeof body.purchase !== "object") {
    return invalid("purchase is required");
  }
  if (Array.isArray(body.purchase))
    return invalid("purchase must be an object");
  const purchaseKeyError = unknownKeys(
    body.purchase,
    ["amount", "currency"],
    "purchase",
  );
  if (purchaseKeyError) return invalid(purchaseKeyError);
  const amount = body.purchase.amount;
  if (amount === undefined || amount === null || amount === "") {
    return invalid("purchase.amount is required");
  }
  if (!Number.isFinite(Number(amount))) {
    return invalid("purchase.amount must be a finite number");
  }
  if (Number(amount) <= 0) {
    return invalid("purchase.amount must be greater than zero");
  }
  if (body.purchase.currency === undefined || body.purchase.currency === null) {
    return invalid("purchase.currency is required");
  }
  const currency = cleanString(body.purchase.currency).toUpperCase();
  if (currency !== "USD") {
    return {
      ok: false,
      status: 422,
      code: "UNSUPPORTED_PURCHASE",
      message: "purchase.currency must be USD",
    };
  }

  if (!body.wallet || typeof body.wallet !== "object") {
    return invalid("wallet is required");
  }
  if (Array.isArray(body.wallet)) return invalid("wallet must be an object");
  const walletKeyError = unknownKeys(body.wallet, ["cards"], "wallet");
  if (walletKeyError) return invalid(walletKeyError);
  if (!Array.isArray(body.wallet.cards)) {
    return invalid("wallet.cards must be an array");
  }
  if (body.wallet.cards.length > 30) {
    return invalid("wallet.cards supports at most 30 cards");
  }
  const cards = body.wallet.cards.map((card: any, index: number) => {
    if (!card || typeof card !== "object" || Array.isArray(card)) {
      return { cardId: "", invalidObjectAt: index };
    }
    const cardKeyError = unknownKeys(
      card,
      ["cardId"],
      `wallet.cards[${index}]`,
    );
    return {
      cardId: normalizeCardId(card.cardId),
      invalidObjectAt: -1,
      tooLong:
        typeof card.cardId === "string" && card.cardId.trim().length > 80,
      cardKeyError,
    };
  });
  const invalidObject = cards.find((card: any) => card.invalidObjectAt >= 0);
  if (invalidObject) {
    return invalid(
      `wallet.cards[${invalidObject.invalidObjectAt}] must be an object`,
    );
  }
  const cardWithUnknownKey = cards.find((card: any) => card.cardKeyError);
  if (cardWithUnknownKey) return invalid(cardWithUnknownKey.cardKeyError);
  const tooLongCardIndex = cards.findIndex((card: any) => card.tooLong);
  if (tooLongCardIndex >= 0) {
    return invalid(
      `wallet.cards[${tooLongCardIndex}].cardId must be 80 characters or fewer`,
    );
  }
  const normalizedCards = cards.map((card: any) => ({ cardId: card.cardId }));
  const invalidCardIndex = normalizedCards.findIndex(
    (card: { cardId: string }) => !card.cardId,
  );
  if (invalidCardIndex >= 0) {
    return invalid(`wallet.cards[${invalidCardIndex}].cardId is required`);
  }
  const uniqueCardIds = new Set(
    normalizedCards.map((card: { cardId: string }) => card.cardId),
  );
  if (uniqueCardIds.size !== normalizedCards.length) {
    return invalid("wallet.cards contains duplicate cardId values");
  }

  return {
    ok: true,
    value: {
      merchant: {
        name: merchantName,
        category: cleanString(body.merchant.category) || undefined,
        domain: cleanString(body.merchant.domain) || undefined,
        mcc: cleanString(body.merchant.mcc) || undefined,
      },
      purchase: {
        amount: Number(amount),
        currency: "USD",
      },
      wallet: {
        cards: normalizedCards,
      },
      context: body.context,
    },
  };
}

function invalid(message: string): RequestValidationResult {
  return {
    ok: false,
    status: 400,
    code: "INVALID_REQUEST",
    message,
  };
}


function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


function normalizeCardId(value: unknown) {
  return cleanString(value).toLowerCase().replace(/_/g, "-");
}


function unknownKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  label: string,
) {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (!unknown.length) return null;
  return `${label} contains unsupported field: ${unknown[0]}`;
}

