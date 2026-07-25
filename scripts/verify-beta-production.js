const { execFileSync } = require("child_process");

const env = {
  ...process.env,
  REWARDLY_EXTENSION_API_BASE:
    process.env.REWARDLY_EXTENSION_API_BASE || "https://rewardly-api.example.com",
  REWARDLY_EXTENSION_APP_URL:
    process.env.REWARDLY_EXTENSION_APP_URL || "https://rewardly.example.com",
};

const commands = [
  ["npm", ["--prefix", "backend", "run", "build"]],
  ["npm", ["--prefix", "backend", "test", "--", "--runInBand"]],
  ["npm", ["--prefix", "frontend-vite", "run", "build"]],
  ["npm", ["--prefix", "frontend-vite", "run", "lint"]],
  ["backend/node_modules/.bin/tsc", ["-p", "packages/rewardly-core/tsconfig.json"]],
  ["node", ["--check", "extension/background.js"]],
  ["node", ["--check", "extension/content.js"]],
  ["node", ["--check", "extension/popup.js"]],
  ["node", ["--check", "extension/popup.production.js"]],
  ["node", ["--check", "extension/config.js"]],
  ["node", ["scripts/package-extension-beta.js"]],
];

for (const [command, args] of commands) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", env });
}

console.log("\nRewardly beta production verification passed.");
