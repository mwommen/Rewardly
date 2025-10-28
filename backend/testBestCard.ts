// backend/testBestCard.ts
// Run with: npx ts-node testBestCard.ts

export {}; // Ensure this file is treated as a module

// Node 18+ has global fetch. If using older Node, uncomment below:
// import fetch from "node-fetch";

type LinkedAccount = {
  name?: string;
  official_name?: string;
  mask?: string;
  subtype?: string;
};

async function testBestCard(): Promise<void> {
  try {
    const url = "http://localhost:5001/api/cards/best-card-for-merchant";

    // Merchant/category that exists in your DB benefits
    const merchant = "groceries";

    // Fake linked accounts to simulate Plaid data
    const linkedAccounts: LinkedAccount[] = [
      {
        name: "Test Card", // matches the Test Card inserted in DB earlier
        official_name: "Test Bank",
      },
      // Add more simulated accounts if needed
    ];

    console.log("Posting to", url);
    console.log("Payload:", { merchant, linkedAccounts });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant, linkedAccounts }),
    });

    if (!res.ok) {
      console.error("Server responded with status", res.status);
      const text = await res.text();
      console.error("Response body:", text);
      return;
    }

    const data = await res.json();
    console.log("Response status:", res.status);
    console.log("Best card for merchant:", JSON.stringify(data.bestCard, null, 2));
  } catch (err) {
    console.error("Error testing best-card-for-merchant:", err);
  }
}

// Run the test
testBestCard();
