# Rewardly Demo Runbook

## Objective

Show that Rewardly catches a real card benefit at checkout:

- Card in wallet: Amex Platinum
- Merchant: Lululemon
- Moment: checkout
- Result: extension popup shows the Lululemon Platinum credit and links to the specific Amex benefit page

## Setup

1. Start MongoDB locally.

2. Seed the demo data:
   ```bash
   cd backend
   npm run seed
   npm run seed:demo
   ```

3. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

4. Start the frontend:
   ```bash
   cd frontend-vite
   npm run dev
   ```

5. Load the Chrome extension:
   - Open `chrome://extensions`
   - Enable Developer mode
   - Click Load unpacked
   - Select the `extension` folder

6. In the Rewardly extension popup:
   - API Base: `http://localhost:5001`
   - User ID: `devUser`
   - Add `Amex Platinum`
   - Save wallet

## Demo URL

Open the launcher:

```text
http://localhost:5173/demo.html
```

If Vite picked a different port, use that port instead.

## 90 Second Script

1. "I have Amex Platinum in my wallet."
2. "I am checking out at Lululemon."
3. "Rewardly detects the checkout page and checks my wallet for live merchant benefits."
4. "It finds the Platinum Lululemon credit before I pay."
5. "Clicking Enroll takes me to the specific Amex benefit flow."
6. "The product catches card benefits at the exact moment they matter."

## Verification

Expected backend payload:

```bash
node -e "(async()=>{const res=await fetch('http://localhost:5001/api/cards/best-card-for-merchant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({merchant:'Lululemon',userId:'devUser',restrictToLinked:true,manualCardSlugs:['amex-platinum']})});const json=await res.json();console.log(json.reason?.credits?.[0]);})();"
```

Expected fields:

- `label`: `$75 statement credit at lululemon each quarter (up to $300/yr)`
- `enrollmentUrl`: `https://global.americanexpress.com/card-benefits/detail/lululemon/platinum`

## Demo Guardrails

- Do not add new features before recording.
- Fix only issues visible in the demo flow.
- Reload the unpacked extension after every extension code change.
- Refresh the checkout page after reloading the extension.
