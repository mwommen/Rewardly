# Rewardly Private Beta Operations

## Create A Tester

```bash
cd backend
npm run beta:create-user -- --name "Friend Name" --email "friend@example.com"
```

Send the printed activation token to the tester once. Do not send database IDs
or hashes.

## Tester Activation Instructions

1. Open the hosted Rewardly website.
2. Enter the activation code.
3. Click `Activate`.
4. Click `Connect Rewardly Extension`.
5. Open the Rewardly extension popup.
6. Enter the one-time extension connection code.
7. Add cards to the wallet.
8. Test checkout recommendations.

## Confirm Activation

```bash
cd backend
npm run beta:list-users
```

Confirm the tester status is `active` and `lastUsedAt` is present.

## Revoke Access

```bash
cd backend
npm run beta:revoke-user -- --user-id <beta-user-id>
```

Revocation clears usable tokens. Website and extension validation should fail on
the next request.

## Rotate Access

```bash
cd backend
npm run beta:rotate-token -- --user-id <beta-user-id>
```

Only send the newly printed session token if you are intentionally recovering a
tester. Prefer issuing a new activation flow when possible.

## Delete A Tester

```bash
cd backend
npm run beta:delete-user -- --user-id <beta-user-id>
```

Use deletion only when intentionally removing a private beta account and wallet.

## Troubleshooting Connection

- Verify Render `/health` and `/ready`.
- Confirm `FRONTEND_ORIGIN` matches the Vercel URL.
- Confirm `EXTENSION_ORIGIN` matches the Chrome extension ID.
- Create a new extension connection code; codes expire after about five minutes.
- Ask the tester to reconnect from the production extension popup.

## Troubleshooting Empty Wallet

- Ask the tester to open the Rewardly extension popup.
- Confirm the popup shows connected state.
- Add cards from the production wallet UI.
- If card save fails, verify the card slug exists in `/api/cards/slugs`.

## Troubleshooting Missing Recommendations

- Confirm the user is connected in the extension.
- Confirm the wallet is non-empty.
- Confirm the merchant is covered by the manifest.
- Check Render logs for safe payment decision errors.
- Do not ask testers to paste tokens into Developer Settings in production.

## Emergency Beta Disable

1. Revoke impacted users.
2. Remove or rotate Render environment variables if a secret is exposed.
3. Disable the Render service if recommendations must stop immediately.
4. Unpublish or pause distribution in the Chrome Web Store if extension access
   must stop for new testers.
