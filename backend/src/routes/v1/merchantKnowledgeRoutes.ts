import { Router } from "express";
import {
  buildMerchantKnowledgeSummary,
  getMerchantInsight,
  getMerchantProfile,
  listMerchantCategories,
  listMerchantProfiles,
  searchMerchantProfiles,
} from "../../services/merchantKnowledgeService";

const router = Router();

router.get("/merchants", (req, res) => {
  res.json({
    merchants: listMerchantProfiles({
      category: stringQuery(req.query.category),
      country: stringQuery(req.query.country),
      limit: numberQuery(req.query.limit),
    }),
    summary: buildMerchantKnowledgeSummary(),
  });
});

router.get("/merchants/:merchantId", (req, res) => {
  const merchant = getMerchantProfile(req.params.merchantId);
  if (!merchant) {
    return res.status(404).json({
      error: {
        code: "MERCHANT_NOT_FOUND",
        message: "merchant not found",
      },
    });
  }
  return res.json({ merchant });
});

router.get("/merchant-search", (req, res) => {
  res.json({
    merchants: searchMerchantProfiles({
      query: stringQuery(req.query.q || req.query.query),
      category: stringQuery(req.query.category),
      country: stringQuery(req.query.country),
      limit: numberQuery(req.query.limit),
    }),
  });
});

router.get("/merchant-categories", (_req, res) => {
  res.json({ categories: listMerchantCategories() });
});

router.get("/merchant-insights", (req, res) => {
  const merchantId = stringQuery(req.query.merchantId || req.query.id);
  if (!merchantId) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "merchantId is required",
      },
    });
  }
  const insight = getMerchantInsight(merchantId);
  if (!insight) {
    return res.status(404).json({
      error: {
        code: "MERCHANT_NOT_FOUND",
        message: "merchant not found",
      },
    });
  }
  return res.json({ insight });
});

export default router;

function stringQuery(value: unknown) {
  return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
}

function numberQuery(value: unknown) {
  const number = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(number) ? number : undefined;
}

export function merchantKnowledgeOpenApiPaths() {
  return {
    "/api/v1/merchants": {
      get: {
        summary: "List merchant knowledge profiles",
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "country", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Merchant profiles",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantListResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/merchants/{merchantId}": {
      get: {
        summary: "Get a merchant profile",
        parameters: [
          {
            name: "merchantId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Merchant profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantProfileResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/MerchantNotFound" },
        },
      },
    },
    "/api/v1/merchant-search": {
      get: {
        summary: "Search merchant profiles",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "country", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Merchant search results",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantSearchResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/merchant-categories": {
      get: {
        summary: "List merchant categories",
        responses: {
          "200": {
            description: "Merchant categories",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantCategoriesResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/merchant-insights": {
      get: {
        summary: "Get deterministic merchant insights",
        parameters: [
          {
            name: "merchantId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Merchant insight",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MerchantInsightResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/InvalidRequest" },
          "404": { $ref: "#/components/responses/MerchantNotFound" },
        },
      },
    },
  };
}

export function merchantKnowledgeOpenApiSchemas() {
  return {
    MerchantKnowledgeProfile: {
      type: "object",
      required: [
        "merchantId",
        "canonicalName",
        "displayName",
        "aliases",
        "category",
        "country",
        "domains",
        "supportedPaymentMethods",
        "loyaltyPrograms",
        "tags",
        "lastUpdated",
      ],
      properties: {
        merchantId: { type: "string" },
        canonicalName: { type: "string" },
        displayName: { type: "string" },
        aliases: { type: "array", items: { type: "string" } },
        category: { type: "string" },
        categoryCode: { type: "string", nullable: true },
        subcategory: { type: "string", nullable: true },
        brand: { type: "string", nullable: true },
        parentCompany: { type: "string", nullable: true },
        merchantGroup: { type: "string", nullable: true },
        country: { type: "string" },
        region: { type: "string", nullable: true },
        domains: { type: "array", items: { type: "string" } },
        checkoutDomains: { type: "array", items: { type: "string" } },
        billingDescriptors: { type: "array", items: { type: "string" } },
        mccs: { type: "array", items: { type: "string" } },
        supportedPaymentMethods: { type: "array", items: { type: "string" } },
        loyaltyPrograms: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        metadata: { type: "object" },
        active: { type: "boolean" },
        confidence: { type: "number" },
        lastUpdated: { type: "string" },
      },
    },
    MerchantListResponse: {
      type: "object",
      properties: {
        merchants: {
          type: "array",
          items: { $ref: "#/components/schemas/MerchantKnowledgeProfile" },
        },
        summary: { type: "object" },
      },
    },
    MerchantProfileResponse: {
      type: "object",
      properties: {
        merchant: { $ref: "#/components/schemas/MerchantKnowledgeProfile" },
      },
    },
    MerchantSearchResponse: {
      type: "object",
      properties: {
        merchants: {
          type: "array",
          items: {
            allOf: [
              { $ref: "#/components/schemas/MerchantKnowledgeProfile" },
              {
                type: "object",
                properties: {
                  score: { type: "number" },
                  matchType: { type: "string" },
                  matchedValue: { type: "string", nullable: true },
                },
              },
            ],
          },
        },
      },
    },
    MerchantCategoriesResponse: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              categoryId: { type: "string" },
              displayName: { type: "string" },
              parentCategoryId: { type: "string", nullable: true },
              aliases: { type: "array", items: { type: "string" } },
              merchantCount: { type: "number" },
            },
          },
        },
      },
    },
    MerchantInsightResponse: {
      type: "object",
      properties: {
        insight: {
          type: "object",
          properties: {
            merchantId: { type: "string" },
            displayName: { type: "string" },
            paymentJourneyEntries: { type: "number" },
            mostUsedCard: { type: "string", nullable: true },
            estimatedRewardsEarned: { type: "number" },
            averagePurchaseAmount: { type: "number", nullable: true },
            plannedSpendingEntries: { type: "number" },
            lastUpdated: { type: "string" },
          },
        },
      },
    },
  };
}

export function merchantKnowledgeOpenApiResponses() {
  return {
    MerchantNotFound: {
      description: "Merchant not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
  };
}
