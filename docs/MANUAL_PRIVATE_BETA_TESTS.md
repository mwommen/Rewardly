# Manual Private Beta Tests

Automation cannot prove everything needed for beta. These checks require a
person or hosted environment.

## Not Automated

- Chrome Web Store approval.
- Real unlisted Chrome Web Store installation.
- Real Render, Vercel, and MongoDB Atlas configuration.
- Real merchant DOM changes and checkout timing.
- Frontend activation DOM behavior in a real browser session.
- Popup lifecycle behavior in a real checkout DOM, including duplicate
  prevention, dismissal persistence, feedback buttons, and reconnect states.
- Visual appearance across screen sizes and zoom levels.
- Whether the popup feels annoying.
- Whether the recommendation is understandable.
- Whether the tester trusts the recommendation.
- Whether the tester changes cards because of Rewardly.
- Chrome restart persistence in a real browser profile.
- Browser update behavior.
- Real production latency.
- Mobile and in-store behavior, which are out of scope.

## 15-Minute Founder Smoke Test After Deployment

1. Open deployed Rewardly.
2. Activate a new beta user with a fresh invitation code.
3. Generate an extension connection code.
4. Install the unlisted Chrome extension.
5. Connect the extension with the one-time code.
6. Add two cards to the wallet.
7. Restart Chrome and confirm the extension remains connected.
8. Visit a supported checkout fixture or real merchant checkout.
9. Confirm Rewardly appears only at payment decision time.
10. Confirm the recommended card is owned by the tester.
11. Submit helpful feedback.
12. Revoke the tester.
13. Confirm website and extension access fail after revocation.

## Qualification Report Review

Before starting manual beta, run:

```bash
npm run qualify:private-beta
```

Open `artifacts/private-beta-qualification.md` and confirm:

- Overall status is `READY`.
- `Orchestrated Beta Flow` passed.
- `Extension Package` passed independent ZIP inspection.
- Any warnings are understood as manual boundaries, not ignored failures.

Record pass/fail in `TEST_RESULTS.md` with dates and exact merchant URLs if real
merchant testing was performed.
