import { getLinkedAccountsCollection } from "../src/db";
import { mapAccountToCardSlug } from "../src/routes/plaidRoutes";

async function run() {
  const linkedCol = await getLinkedAccountsCollection();
  const userId = "devUser";

  // Remove existing linked docs for user
  await linkedCol.deleteMany({ userId });
  console.log(`Cleared linked accounts for user ${userId}`);

  // Insert demo linked doc
  const demoLinked = {
    userId,
    itemId: "demo_item_reset",
    accessToken: "demo_access_reset",
    institution: { id: "ins_demo", name: "Demo Bank" },
    accounts: [
      {
        accountId: "demo_acc_chase",
        mask: "1234",
        name: "Chase Sapphire Reserve",
        official_name: "Sapphire Reserve",
        type: "credit",
        subtype: "credit card",
      },
      {
        accountId: "demo_acc_capitalone",
        mask: "5678",
        name: "Capital One Venture X",
        official_name: "Venture X",
        type: "credit",
        subtype: "credit card",
      },
      {
        accountId: "demo_acc_amex",
        mask: "0007",
        name: "American Express Gold",
        official_name: "Amex Gold",
        type: "credit",
        subtype: "credit card",
      },
      {
        accountId: "demo_acc_checking",
        mask: "4321",
        name: "Demo Checking",
        official_name: "Checking",
        type: "depository",
        subtype: "checking",
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertRes = await linkedCol.insertOne(demoLinked as any);
  console.log("Inserted demo linked doc:", insertRes.insertedId);

  // Now remap accounts using exported mapAccountToCardSlug
  const docs = await linkedCol.find({ userId }).toArray();
  await Promise.all(
    docs.map(async (doc) => {
      const accounts = (doc.accounts || []).map((account: any) => ({
        ...account,
        mappedCardSlug: mapAccountToCardSlug({
          name: account.name,
          official_name: account.official_name,
          type: account.type,
          subtype: account.subtype,
        }),
      }));
      await linkedCol.updateOne({ _id: doc._id }, { $set: { accounts, updatedAt: new Date() } });
    })
  );

  console.log("Remapped demo accounts using mapping logic.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
