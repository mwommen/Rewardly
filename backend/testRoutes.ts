// backend/testRoutes.ts

// Base URL of your backend
const BASE_URL = "http://localhost:5001/api/cards";

// Helper function to test GET routes
async function testGetAllCards() {
  try {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error(`Failed to fetch all cards: ${res.statusText}`);
    const data = await res.json();
    console.log("GET /api/cards response:");
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}

// Helper function to test GET /best-card/:category
async function testGetBestCard(category: string) {
  try {
    const res = await fetch(`${BASE_URL}/best-card/${category}`);
    if (!res.ok) throw new Error(`Failed to fetch best card for ${category}: ${res.statusText}`);
    const data = await res.json();
    console.log(`GET /api/cards/best-card/${category} response:`);
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}

// Helper function to test POST /api/cards
async function testAddCard() {
  try {
    const newCard = {
      name: "Test Card",
      issuer: "Test Bank",
      type: "Rewards",
      annualFee: 0,
      apr: "15.99%",
      benefits: { groceries: 3, travel: 2 },
      perks: ["Test perk 1", "Test perk 2"],
    };

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCard),
    });

    if (!res.ok) throw new Error(`Failed to add card: ${res.statusText}`);
    const data = await res.json();
    console.log("POST /api/cards response:");
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}

// Run all tests sequentially
(async () => {
  await testGetAllCards();
  await testAddCard();
  await testGetBestCard("groceries");
})();
