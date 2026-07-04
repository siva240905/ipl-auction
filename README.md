# IPL Auction Multiplayer Game

A real-time, multiplayer IPL Auction Game with live match simulation, built using Node.js, Express, Socket.io, and React.

## Features

- **Multiplayer Real-time Bidding**: Join rooms with friends and place bids on players in real-time.
- **AI Bot Managers**: Fill empty lobby slots with AI managers who bid dynamically based on player ratings and roles.
- **Match & Tournament Simulator**: Simulate a full IPL-style tournament with playoffs (Qualifier, Eliminator, Semi-Final, Final) using squad metrics.
- **Scoring & Leaderboards**: Points are awarded based on squad quality (batting/bowling/wicketkeeping balance), superstar ratings, and leftover budgets.
- **Dynamic Bidding Increment Rules**: Real IPL increment rules applied based on current bid values.

## Technologies Used

- **Frontend**: React, TailwindCSS, Vite, Lucide React, Socket.io-client
- **Backend**: Node.js, Express, Socket.io, Mongoose (with fallback in-memory mode)

## How to Run

### 1. Run the Backend Server
```bash
cd backend
npm install
node server.js
```
The server will run on `http://localhost:5000` (falling back to in-memory mode if MongoDB is not running).

### 2. Run the Frontend App
```bash
cd frontend
npm install
npm run dev
```
The client app will be served at `http://localhost:5173`.
