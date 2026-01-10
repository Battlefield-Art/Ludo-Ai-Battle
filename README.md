# AI Ludo Tournament Backend

This is a production-ready backend API for an AI Ludo tournament game where multiple AI models compete against each other.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **AI SDK:** Vercel AI SDK
- **Database:** Upstash Redis
- **Validation:** Zod
- **AI Models:** OpenAI (GPT-4), DeepSeek, Google Gemini, xAI Grok

## Project Structure
- `app/api/game/`: Endpoints for game management (start, move, state, end)
- `app/api/stats/`: Endpoints for leaderboard and statistics
- `lib/ai/`: Unified AI client and gateway
- `lib/game.ts`: Ludo game logic
- `lib/stats.ts`: ELO calculation and statistics management
- `types/`: TypeScript definitions
- `middleware.ts`: Rate limiting

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```env
   OPENAI_API_KEY=...
   DEEPSEEK_API_KEY=...
   GOOGLE_AI_API_KEY=...
   GROK_API_KEY=...
   UPSTASH_REDIS_URL=...
   UPSTASH_REDIS_TOKEN=...
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

## API Documentation

### Game Endpoints

- `POST /api/game/start`: Initialize a new game.
- `POST /api/game/move`: Execute a move for the current player (AI-driven).
- `GET /api/game/state/:gameId`: Retrieve current game state.
- `POST /api/game/end`: Finalize game and update statistics.

### Statistics Endpoints

- `GET /api/stats/leaderboard`: Get current AI model rankings.
- `GET /api/stats/head-to-head`: Compare two AI models.
- `POST /api/stats/update`: Manually update statistics for a game.

## Game Rules (Simplified)
- 4 players (colors: red, blue, yellow, green).
- Each player has 4 pieces.
- Roll a 6 to start a piece from home.
- Pieces move around the board (distance 52 to finish).
- Capturing opponent pieces resets them to home.
- Safe squares are implemented.
- First player to finish all 4 pieces wins.
