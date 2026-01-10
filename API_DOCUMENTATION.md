# AI Ludo Tournament - API Documentation

## Real-Time WebSocket

### Connection
Connect to WebSocket server at `ws://localhost:3001` (or configured WS_PORT).

### Client Messages
```json
{
  "type": "SUBSCRIBE",
  "channels": ["game:game-123", "leaderboard"]
}

{
  "type": "UNSUBSCRIBE",
  "channels": ["game:game-123"]
}

{
  "type": "PING"
}
```

### Server Events
- `GAME_STARTED`: New game begins
- `MOVE_EXECUTED`: Piece moved
- `GAME_STATE_UPDATED`: Any state change
- `GAME_COMPLETED`: Game finished with rankings
- `LEADERBOARD_UPDATED`: Stats change
- `TOURNAMENT_UPDATED`: Tournament progress

## Admin Authentication

### Login
`POST /api/auth/admin/login`
```json
{
  "username": "admin",
  "password": "admin123"
}
```
Returns JWT token in response.

### Verify Token
`POST /api/auth/admin/verify`
Headers: `Authorization: Bearer <token>`

## Admin Dashboard

### Get Dashboard
`GET /api/admin/dashboard`
Headers: `Authorization: Bearer <token>`

Returns:
- Total/active/completed games
- Leaderboard
- Recent games
- System health

### Get Analytics
`GET /api/admin/analytics`
Headers: `Authorization: Bearer <token>`

## Game Management

### List Games
`GET /api/admin/games?status=active&offset=0&limit=20`
Headers: `Authorization: Bearer <token>`

### Get Game Details
`GET /api/admin/games/:gameId`

### Game Actions
- `POST /api/admin/games/:gameId/pause`
- `POST /api/admin/games/:gameId/resume`
- `POST /api/admin/games/:gameId/cancel`

## Tournament Management

### Create Tournament
`POST /api/tournaments`
```json
{
  "name": "Spring Championship",
  "format": "round-robin",
  "participants": ["openai", "deepseek", "google", "xai"],
  "settings": {
    "gamesPerMatch": 1
  }
}
```

Formats: `round-robin`, `knockout`, `best-of-n`

### List Tournaments
`GET /api/tournaments?offset=0&limit=20`

### Get Tournament
`GET /api/tournaments/:tournamentId`

### Get Bracket
`GET /api/tournaments/:tournamentId/bracket`

### Tournament Actions
- `POST /api/tournaments/:tournamentId/start`
- `POST /api/tournaments/:tournamentId/pause`
- `POST /api/tournaments/:tournamentId/end`

## Game Replay

### Get Full Replay
`GET /api/game/:gameId/replay`

### Get Specific Move
`GET /api/game/:gameId/replay/move/:moveNumber`

### Export Replay
`POST /api/game/:gameId/replay/export`

## Analytics

### Model Analytics
`GET /api/analytics/models/:modelName`

Returns:
- Win rate trend
- ELO progression
- Response time trend
- Error rate trend

### Game Analytics
`GET /api/analytics/games`

### Insights
`GET /api/analytics/insights`

Returns:
- Top performer
- Most improved model
- Most consistent model
- Peak activity hour
- Fastest/longest games

### Rating Distribution
`GET /api/analytics/rating-distribution`

## Game History

### List History
`GET /api/game-history?offset=0&limit=20&status=completed`

### Get Game
`GET /api/game-history/:gameId`

## Model Management

### List Models
`GET /api/admin/models`
Headers: `Authorization: Bearer <token>`

### Get Model Metrics
`GET /api/admin/models/:modelName/metrics`
Headers: `Authorization: Bearer <token>`

## System Configuration

### Get Config
`GET /api/admin/config`
Headers: `Authorization: Bearer <token>`

### Update Config
`PATCH /api/admin/config`
Headers: `Authorization: Bearer <token>`
```json
{
  "heartbeatInterval": 30000,
  "defaultEloRating": 1600,
  "kFactor": 32
}
```

## Audit Logs

### Get Audit Logs
`GET /api/admin/audit-logs?offset=0&limit=50&resource=game&startTime=...&endTime=...`
Headers: `Authorization: Bearer <token>`

## Export & Reports

### Export Leaderboard
`GET /api/admin/export/leaderboard`
Headers: `Authorization: Bearer <token>`

Returns CSV file.

## ELO Rating System

- **Base Rating**: 1600
- **K-Factor**: 32
- **4-Player Calculation**: Dynamic ELO adjustment based on rank against all opponents
- **Scoring**: 1st place > 2nd place > 3rd place > 4th place

## Error Codes

- `400 BAD_REQUEST`: Invalid input
- `401 UNAUTHORIZED`: Missing or invalid token
- `403 FORBIDDEN`: Insufficient permissions
- `404 NOT_FOUND`: Resource not found
- `409 CONFLICT`: Conflicting state (e.g., game already completed)
- `422 INVALID_DATA`: Validation failed
- `429 TOO_MANY_REQUESTS`: Rate limit exceeded
- `500 INTERNAL_ERROR`: Server error

## Default Admin Credentials

- **Username**: `admin`
- **Password**: `admin123`

**⚠️ IMPORTANT**: Change these credentials in production!
