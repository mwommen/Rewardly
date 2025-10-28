Credit Card Optimizer

Credit Card Optimizer is a web application that helps users identify which of their current credit cards will provide the most benefits for a specific purchase in real-time. For example, if a user is shopping on Nike.com, the app will recommend which of their credit cards will earn the most points, cashback, or rewards based on current offers and partnerships.


Project Structure
root/
├─ backend/          # Node/TypeScript backend API
├─ frontend-vite/    # React + Vite frontend
├─ package.json      # Root monorepo package file (optional)
├─ README.md         # Project documentation

Features

Real-time credit card recommendations based on purchase category.

Backend API for storing and retrieving card details.

Frontend interface to display card suggestions and benefits.

Modular architecture: backend and frontend run independently.

Getting Started
1. Clone the repository
git clone https://github.com/mwommen/credit-card-optimizer.git
cd credit-card-optimizer

2. Backend Setup
cd backend
npm install
npm run dev


Runs the backend server on http://localhost:5000 (or configured port in .env).

API endpoints available under /api/cards for managing credit card data.

3. Frontend Setup
cd frontend-vite
npm install
npm run dev


Runs the frontend on http://localhost:5173 (default Vite port).

Connects to backend API to fetch credit card data and display recommendations.

4. Environment Variables

Create a .env file in the backend/ folder with the following:

PORT=5000
DB_URL=<your_database_connection_string>
API_KEY=<optional_external_api_keys>


Frontend can also have a .env for API base URL if needed:

VITE_API_BASE_URL=http://localhost:5000

Technologies Used

Backend: Node.js, TypeScript, Express

Frontend: React, TypeScript, Vite

Database: MongoDB / any preferred database

Version Control: Git, GitHub

Future Improvements

Integrate real-time merchant offers and partnerships.

Add user authentication and saved card preferences.

Improve recommendation algorithm for maximum reward optimization.

Mobile-friendly responsive frontend.