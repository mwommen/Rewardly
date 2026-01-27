import type { Page } from "playwright";

export type PartialCard = {
  name?: string;
  issuer?: string | null;
  annualFee?: number | null;
  apr?: string | null;
  rewardsByCategory?: Record<string, number>;
  perks?: string[];
  signupOffer?: string | null;
  confidence?: number; // heuristic 0..1
  sourceUrl?: string;
};

export interface ScrapeAdapter {
  id: string;
  matches: (url: string) => boolean;
  run: (page: Page, url: string) => Promise<PartialCard>;
}
