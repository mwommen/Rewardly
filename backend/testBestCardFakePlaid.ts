// backend/testBestCardFakePlaid.ts
// Run with: npx ts-node testBestCardFakePlaid.ts

type LinkedAccount = {
  name?: string;
  official_name?: string;
  mask?: string;
  subtype?: string;
};

async function testBestCard() {
  try {
    const url = "http://localhost:5001/api/cards/best-card-for-merchant";

    // Merchant to test (must match a benefit in DB/Test Card)
    const merchant = "groceries";

    // Fake linked accounts (simulate Plaid)
    const linkedAccounts: LinkedAccount[] = [
      {
        name: "Test Card",      // matches our Test Card in backend
        official_name: "Test Bank",
      },
    ];

    console.log("Posting to:", url);
    console.log("Payload:", { merchant, linkedAccounts });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant, linkedAccounts }),
    });

    if (!res.ok) {
      throw new Error(`Server responded with status ${res.status}`);
    }

    const data = await res.json();
    console.log("Response status:", res.status);
    console.log("Best card response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error testing best-card-for-merchant:", err);
  }
}

testBestCard();
