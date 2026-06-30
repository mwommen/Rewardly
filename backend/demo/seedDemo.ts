import { getLinkedAccountsCollection, getUserBenefitStatesCollection, getCardsCollection } from "../src/db";

async function run() {
  const linkedCol = await getLinkedAccountsCollection();
  const benefitCol = await getUserBenefitStatesCollection();
  const cardsCol = await getCardsCollection();

  // Ensure base cards exist
  const baseCards = await cardsCol.find({}).toArray();
  if (!baseCards || baseCards.length === 0) {
    console.log("No cards seeded. Run npm run seed first to populate card catalog.");
    process.exit(1);
  }

  const demoLinked = {
    userId: "devUser",
    itemId: "demo_item_1",
    accessToken: "demo_access_1",
    institution: { id: "ins_demo", name: "Demo Bank" },
    accounts: [
      {
        accountId: "demo_acc_chase",
        mask: "1234",
        name: "Chase Sapphire Reserve",
        official_name: "Sapphire Reserve",
        type: "credit",
        subtype: "credit card",
        mappedCardSlug: "chase-sapphire-reserve",
      },
      {
        accountId: "demo_acc_capitalone",
        mask: "5678",
        name: "Capital One Venture",
        official_name: "Venture",
        type: "credit",
        subtype: "credit card",
        mappedCardSlug: "capital-one-venture",
      },
      {
        accountId: "demo_acc_amex",
        mask: "1007",
        name: "American Express Platinum",
        official_name: "The Platinum Card from American Express",
        type: "credit",
        subtype: "credit card",
        mappedCardSlug: "amex-platinum",
      },
      {
        accountId: "demo_acc_checking",
        mask: "4321",
        name: "Demo Checking",
        official_name: "Checking",
        type: "depository",
        subtype: "checking",
        mappedCardSlug: "",
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await linkedCol.updateOne({ userId: demoLinked.userId, itemId: demoLinked.itemId }, { $set: demoLinked }, { upsert: true });

  // Add a few user benefit states to demo
  const benefits = [
    {
      userId: "devUser",
      benefitKey: "amex-platinum::$75 statement credit at lululemon each quarter (up to $300/yr)",
      cardSlug: "amex-platinum",
      cardName: "The Platinum Card® from American Express",
      label: "$75 statement credit at lululemon each quarter (up to $300/yr)",
      period: "quarter",
      amountUSD: 75,
      requiresEnrollment: true,
      enrolled: false,
      remindEnabled: true,
      updatedAt: new Date(),
    },
    {
      userId: "devUser",
      benefitKey: "venturex-travel-credit",
      cardSlug: "capital-one-venture-x",
      cardName: "Capital One Venture X",
      label: "$300 travel credit",
      period: "year",
      amountUSD: 300,
      requiresEnrollment: false,
      enrolled: true,
      remindEnabled: false,
      updatedAt: new Date(),
    },
  ];

  for (const b of benefits) {
    await benefitCol.updateOne({ userId: b.userId, benefitKey: b.benefitKey }, { $set: b }, { upsert: true });
  }

  console.log("Demo seed complete for user 'devUser'. Linked accounts and benefit states inserted.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
