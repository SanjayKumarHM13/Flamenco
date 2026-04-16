# Spread OS - AI-First HFT Platform

Spread OS is a premium, high-profile professional-grade trading platform designed for high-frequency statistical arbitrage. It features a three-layer AI stack for signal generation, regime detection, and portfolio allocation.

## Key Features

- **Professional UI/UX**: A sleek, dark-mode first aesthetic inspired by Bloomberg Terminal and modern crypto exchanges.
- **AI Command Center**: Real-time visualization of LSTM regime detection and XGBoost meta-model allocations.
- **Interactive Equity Chart**: Real-time portfolio performance tracking with auto-updating equity curves.
- **Intelligent AI Assistant**: A Gemini-powered trading chatbot for market analysis, Q&A, and news summarization.
- **Real-Time Data**: WebSocket-driven ticker updates, system status, and trade confirmations.
- **Secure Authentication**: Robust login and registration flow with session management.
- **KPI Dashboard**: Track Total P&L, Win Rate, Active Positions, and Max Drawdown.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion, Recharts, Shadcn/UI.
- **Backend**: Node.js, Express, WebSockets (ws).
- **AI**: Google Gemini API (@google/genai).

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Gemini API Key (set in `.env`)

### Local Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd spread-os
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```

5. **Access the Application**:
   Open your browser and navigate to `http://localhost:3000`.

### Demo Credentials

- **Email**: `demo@example.com`
- **Password**: `password`

## Project Structure

- `src/components/`: Reusable UI components and feature-specific widgets.
- `src/lib/`: Utility functions and AI service integration.
- `src/types.ts`: Global TypeScript interfaces and types.
- `server.ts`: Express server with WebSocket logic and state simulation.
- `metadata.json`: Application metadata and permissions.
