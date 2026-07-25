# Rewardly Chrome Web Store Release

## Founder Action Required

1. Create a Chrome Web Store developer account.
2. Create an Unlisted extension item for Rewardly.
3. Copy the final extension ID into Render as `EXTENSION_ORIGIN`.
4. Prepare listing screenshots and privacy disclosures.

## Build The Beta Package

From the repository root:

```bash
REWARDLY_EXTENSION_API_BASE=https://<render-service> \
REWARDLY_EXTENSION_APP_URL=https://<vercel-app> \
npm run extension:package:beta
```

Output:

```text
release/rewardly-extension-beta.zip
release/rewardly-extension-beta-report.json
```

The package command validates:

- Manifest V3
- Production API and app origins
- No localhost permissions
- No Developer Settings markup
- No API Base, User ID, token-entry, or debug controls
- No tests, docs, `.env` files, source maps, or local config
- No unsafe development strings

## Version Bumping

Update `extension/manifest.json` before building a new upload. Keep beta
versions simple and traceable, for example `1.0.1`, `1.0.2`.

## Required Assets

- Extension icon set.
- Checkout recommendation screenshot.
- Extension popup connected-state screenshot.
- Brief beta-focused listing copy.
- Privacy disclosure explaining no card numbers are collected.

## Distribution

Select `Unlisted` distribution for the first private beta. Do not publish as a
public listing until beta reliability and privacy review are complete.

## Uploading An Update

1. Bump version.
2. Run `npm run verify:beta-production`.
3. Run `npm run extension:package:beta` with real HTTPS origins.
4. Upload `release/rewardly-extension-beta.zip`.
5. Save the package checksum from the inspection report.

## Rollback

Chrome Web Store does not provide instant binary rollback. To recover:

1. Bump the manifest version.
2. Rebuild the last known-good source.
3. Upload the replacement package.
4. Revoke impacted beta users if access integrity is involved.

## Review Limitations

Chrome review timing is controlled by Google. Founder action is required for
developer account setup, privacy disclosures, screenshots, final submission, and
any reviewer questions.
