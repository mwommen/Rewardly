import { resolveMerchant } from "../src/services/merchantDetectionService";
import {
  detectMerchant,
  normalizeMerchantName,
} from "../../packages/rewardly-core/src/merchantDetection";

describe("merchant detection normalization", () => {
  const supportedHosts = [
    ["www.amazon.com", "Amazon"],
    ["target.com", "Target"],
    ["www.walmart.com", "Walmart"],
    ["costco.com", "Costco"],
    ["www.bestbuy.com", "Best Buy"],
    ["apple.com", "Apple"],
    ["nike.com", "Nike"],
    ["www.homedepot.com", "Home Depot"],
    ["lowes.com", "Lowe's"],
    ["doordash.com", "DoorDash"],
    ["ubereats.com", "Uber Eats"],
    ["starbucks.com", "Starbucks"],
    ["delta.com", "Delta"],
    ["united.com", "United"],
    ["southwest.com", "Southwest"],
    ["marriott.com", "Marriott"],
    ["hilton.com", "Hilton"],
    ["airbnb.com", "Airbnb"],
    ["expedia.com", "Expedia"],
    ["www.booking.com", "Booking.com"],
  ];

  test.each(supportedHosts)(
    "detects %s as canonical merchant %s",
    (hostname, expectedName) => {
      expect(detectMerchant({ hostname }).name).toBe(expectedName);
    },
  );

  test("maps common host variants to canonical merchants", () => {
    expect(detectMerchant({ hostname: "smile.amazon.com" }).name).toBe(
      "Amazon",
    );
    expect(detectMerchant({ hostname: "www.amazon.com" }).name).toBe("Amazon");
    expect(detectMerchant({ hostname: "m.target.com" }).name).toBe("Target");
    expect(detectMerchant({ hostname: "secure.booking.com" }).name).toBe(
      "Booking.com",
    );
  });

  test("uses title and page text when host is not enough", () => {
    expect(
      detectMerchant({
        hostname: "checkout.example",
        title: "Apple Store Checkout",
      }).name,
    ).toBe("Apple");

    expect(
      detectMerchant({
        hostname: "pay.example",
        pageText: "Review your DoorDash order before payment",
      }).name,
    ).toBe("DoorDash");
  });

  test("normalizes explicit merchant names before backend resolution", () => {
    expect(normalizeMerchantName("uber eats")).toBe("Uber Eats");
    expect(normalizeMerchantName("booking.com")).toBe("Booking.com");
    expect(resolveMerchant({ merchant: "amazon.com" }).name).toBe("Amazon");
  });
});
