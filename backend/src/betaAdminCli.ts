import "dotenv/config";
import {
  createBetaUser,
  deleteBetaUser,
  ensureBetaIndexes,
  listBetaUsers,
  revokeBetaUser,
  rotateBetaSessionToken,
} from "./services/betaAuthService";
import { connectDB } from "./db";

async function main() {
  await connectDB();
  await ensureBetaIndexes();

  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  if (command === "create-user") {
    const { user, activationToken } = await createBetaUser({
      name: args.name,
      email: args.email,
    });
    console.log(JSON.stringify({
      userId: user.userId,
      status: user.status,
      name: user.name || null,
      email: user.email || null,
      activationToken,
      sendToTester: `Use this Rewardly activation code once: ${activationToken}`,
    }, null, 2));
    return;
  }

  if (command === "list-users") {
    const users = await listBetaUsers();
    console.log(JSON.stringify(users, null, 2));
    return;
  }

  if (command === "revoke-user") {
    const userId = required(args["user-id"], "--user-id is required");
    console.log(JSON.stringify({ userId, revoked: await revokeBetaUser(userId) }, null, 2));
    return;
  }

  if (command === "rotate-token") {
    const userId = required(args["user-id"], "--user-id is required");
    const sessionToken = await rotateBetaSessionToken(userId);
    console.log(JSON.stringify({
      userId,
      sessionToken,
      sendToTester: `Use this Rewardly session token: ${sessionToken}`,
    }, null, 2));
    return;
  }

  if (command === "delete-user") {
    const userId = required(args["user-id"], "--user-id is required");
    const result = await deleteBetaUser(userId);
    console.log(JSON.stringify({ userId, ...result }, null, 2));
    return;
  }

  console.error(`Unknown beta admin command: ${command || "(missing)"}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key?.startsWith("--")) {
      parsed[key.slice(2)] = value || "";
      index += 1;
    }
  }
  return parsed;
}

function required(value: string | undefined, message: string) {
  if (!value) throw new Error(message);
  return value;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
