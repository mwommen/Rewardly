# Rewardly

Rewardly is a wallet assistant that helps users decide which card to use before they pay. Instead of asking for merchant domain, MCC, and amount upfront, the app starts with one question: "What are you buying or trying to use?"

The frontend keeps the recommendation engine behind the scenes and presents the result as:

- Best card to use
- Why
- Benefits you would unlock
- Confidence

Developer/debug fields are still available when testing exact domains, amounts, and MCC mappings.

## Project Structure

```text
root/
├─ backend/          # Node/TypeScript backend API
├─ frontend-vite/    # React + Vite frontend
├─ package.json      # Root monorepo package file
├─ README.md         # Project documentation
```

## Features

- Natural-language wallet assistant search.
- Best-card recommendation with plain-English reasoning.
- Benefit search across relevant card perks and offers.
- Hidden developer mode for merchant/domain/amount/MCC testing.
- Modular backend and frontend apps that run independently.

## Getting Started

1. Clone the repository

```bash
git clone https://github.com/mwommen/credit-card-optimizer.git
cd credit-card-optimizer
```

2. Backend setup

```bash
cd backend
npm install
npm run dev
```

Runs the backend server on `http://localhost:5000` or the configured port in `.env`.

3. Frontend setup

```bash
cd frontend-vite
npm install
npm run dev
```

Runs the frontend on `http://localhost:5173`.

4. Environment variables

Backend `.env`:

```bash
PORT=5000
DB_URL=<your_database_connection_string>
API_KEY=<optional_external_api_keys>
```

Frontend `.env`:

```bash
VITE_API_BASE_URL=http://localhost:5000
```

## Technologies Used

- Backend: Node.js, TypeScript, Express
- Frontend: React, TypeScript, Vite
- Database: MongoDB
- Version control: Git, GitHub

## Future Improvements

- Integrate real-time merchant offers and partnerships.
- Add user authentication and saved card preferences.
- Improve recommendation coverage across issuers.
- Add first-time wallet onboarding.
