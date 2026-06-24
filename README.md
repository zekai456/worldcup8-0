# World Cup 8-0

[中文说明](README.zh-CN.md)

Build a historic football Dream XI, survive a 2026 World Cup route, and let an AI match director turn every round into a broadcast-style story.

World Cup 8-0 is a React + Node football strategy game inspired by the "82-0" challenge format, rebuilt for 11-a-side international football. You draft players from real World Cup squads across eras, manage formation fit and bench depth, face classic national teams, watch AI-generated live commentary, answer hostile press conferences, and chase an eight-match title run.

## What Makes It Different

- **Historic Dream XI drafting**: Roll a year and nation, then pick from that World Cup squad.
- **11-a-side tactical board**: Formation slots, position fit, out-of-position punishment, and two substitutes.
- **Classic opponent pool**: Champions plus legendary non-champions such as 1954 Hungary, 1974 Netherlands, 1982 Brazil, 2018 Belgium, 2022 France, and more.
- **AI match simulation**: The backend locks the score and then generates 14-18 score-aware broadcast events with goals, corners, free kicks, saves, cards, substitutions, tactical shifts, and big chances.
- **Score-consistent commentary**: Goal events are aligned with the final score; non-goal events never change the scoreboard.
- **FC-style match UI**: Modern broadcast scoreboard, animated live feed, mini pitch, and post-match panels.
- **Every-match stats**: Team comparison plus player-style match honors after each game.
- **Press conference butterfly effects**: Free-text answers shape media reaction, morale, and next-round context.
- **Tournament awards**: Golden Ball, Golden Boot, Golden Glove, assist leaders, MVP table, save leaders, team stats, badges, and campaign ceremony.
- **Chinese / English mode**: Main UI and generated AI content can follow the selected language.

## Tech Stack

```text
client/   React + Vite
server/   Node.js + Express
db/       MySQL cache for imported/generated World Cup squads
ai/       OpenAI-compatible API, defaulting to DeepSeek
```

The browser never calls the AI provider directly. The client requests `/api/*`; the Express server owns API keys, database access, prompt construction, match normalization, and static frontend hosting.

## Game Loop

1. Choose an era range from 1930 to 2026.
2. Pick a formation.
3. Spin a World Cup year and country.
4. Draft one player from that squad into the tactical board.
5. Fill the starting XI and two substitute slots.
6. Handle pre-match incidents.
7. Simulate the match and watch live AI commentary.
8. Review team stats and player stats after full time.
9. Answer the press.
10. Advance through group matches, knockouts, semi-final, and final.

Lose once and the newspaper writes your obituary. Win all eight and the Dream XI becomes a legend.

## Project Structure

```text
.
├── client/
│   ├── src/
│   │   ├── components/       # Draft, match broadcast, press, headline, tournament UI
│   │   ├── App.jsx           # Main game state machine
│   │   ├── tournament*.js    # Route, fixtures, awards, standings
│   │   └── i18n.js           # Chinese / English UI helpers
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes.js         # HTTP API
│   │   ├── prompts.js        # AI prompt orchestration
│   │   ├── matchEngine.js    # Score/commentary normalization and stats
│   │   ├── teamAssessment.js # Squad strength and matchup judgment
│   │   ├── db.js             # MySQL squad cache
│   │   └── index.js          # Express entry
│   └── package.json
├── package.json              # Root scripts
└── README.md
```

## Requirements

- Node.js 18+
- npm
- Optional MySQL database for squad cache
- OpenAI-compatible chat API key

The app can run without MySQL; it will skip cache features when the database is unavailable.

## Environment Variables

The server reads environment variables directly. A `.env` file is optional, not required.

| Variable | Required | Default | Description |
|---|---:|---|---|
| `PORT` | No | `8787` | Express server port |
| `OPENAI_API_KEY` | Yes for AI | none | API key for the OpenAI-compatible provider |
| `OPENAI_BASE_URL` | No | `https://api.deepseek.com` | AI provider base URL |
| `OPENAI_MODEL` | No | `deepseek-v4-flash` | Chat model name |
| `DB_HOST` | No | none | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | No | none | MySQL user |
| `DB_PASSWORD` | No | none | MySQL password |
| `DB_NAME` | No | none | MySQL database |

PowerShell example:

```powershell
$env:OPENAI_API_KEY="your_key"
$env:OPENAI_BASE_URL="https://api.deepseek.com"
$env:OPENAI_MODEL="deepseek-v4-flash"
$env:PORT=8787
npm start
```

Linux/macOS example:

```bash
OPENAI_API_KEY="your_key" PORT=8787 npm start
```

## Install

```bash
npm run install:all
```

Or install separately:

```bash
npm --prefix server install
npm --prefix client install
```

## Development

Start the backend:

```bash
npm run dev:server
```

Start the Vite frontend:

```bash
npm run dev:client
```

The Vite dev server proxies `/api` to `http://localhost:8787`.

## Production Build

Build the frontend:

```bash
npm run build
```

Start the single Express server:

```bash
npm start
```

Express serves `client/dist` and the API from the same origin:

```text
http://localhost:8787/
http://localhost:8787/api/health
```

For deployment behind Nginx, point your reverse proxy to the Node server and keep `/api` on the same origin.

## API Overview

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/config` | Years, formations, commentary styles |
| `GET` | `/api/era/:year` | Era flavor text |
| `POST` | `/api/spin` | Roll a year and country |
| `POST` | `/api/squad` | Load imported/cached/generated squad |
| `POST` | `/api/player-bio` | Generate player card story |
| `POST` | `/api/opponent` | Roll historic strong opponent |
| `POST` | `/api/event` | Pre-match incident |
| `POST` | `/api/match` | Match simulation, commentary, stats |
| `POST` | `/api/other-match` | Simulate non-player fixture |
| `POST` | `/api/press` | Press reaction and effects |
| `POST` | `/api/endgame` | Final newspaper story |
| `POST` | `/api/awards` | Tournament awards and leaderboards |

## Deployment Notes

If the frontend is served by the Express app, no frontend API URL change is needed. The client calls relative `/api` paths.

If you deploy frontend and backend separately, update `client/src/api.js` to use your backend origin:

```js
fetch(`https://your-backend.example.com/api${path}`)
```

Do not commit `.env`, API keys, database credentials, `node_modules`, or `client/dist`.

## Current Status

This is a playable prototype with a full campaign loop, AI commentary, bilingual UI, tournament state, technical stats, awards, and deployment-ready single-process hosting.

## License

MIT License. See [LICENSE](LICENSE).
