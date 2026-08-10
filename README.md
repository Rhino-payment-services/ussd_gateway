# DialForge

This repo is a **telecom-style sandbox**: the simulator and API **forward** USSD-shaped requests to **your** HTTP callback (DialForge-style `CON` / `END` text). **Menu and business logic live only in your external backend**, not in this gateway.

## Architecture

```text
User → Simulator UI → This gateway → Your callback URL → CON/END response → UI
```

| Layer | Role |
|-------|------|
| API | Session IDs, Redis sessions, provider payload shaping, forwarding, retries/delay, logging |
| Data | PostgreSQL: users, **webhook profiles** (saved callbacks), request history |
| Sessions | Redis: telecom session continuation metadata |
| Realtime | Socket.IO: requests / responses / errors |
| UI | Simulator (keypad + inspector), dashboard (profiles, logs, API test) |
| Docs | Swagger UI at `/api/docs` |

## Repository layout

```text
backend/          Express: simulate, forwarder, provider adapters, JWT, Socket.IO
frontend/       Vite React: simulator + dashboard
docker-compose.yml
README.md
```

### Backend structure

- `src/controllers` – HTTP handlers  
- `src/routes` – Auth, simulate, USSD legacy, dashboard, examples  
- `src/services` – `simulateService` (orchestration), session store, webhook forwarder, auth  
- `src/middleware` – JWT, validation errors, simulate rate limit  
- `src/redis` – Redis client  
- `src/db` – Prisma client  
- `src/telecom` – CON/END parsing, payload building  
- `src/adapters` – Provider-specific outbound shapes (DialForge, MTN, Airtel, Nexen, Custom)  
- `src/engine` – Optional **local** flow JSON interpreter (flow builder / templates only — not used for live simulate)  
- `src/logger` – JSON structured logs  
- `src/socket` – Socket.IO broadcast hub  

### Frontend structure

- `src/pages` – Simulator, auth, dashboard sections  
- `src/components` – Layout shell  
- `src/hooks` – Socket log stream  
- `src/services` – Axios client, Socket.IO client  
- `src/store` – Zustand (auth + theme)  

## Quick start (local)

### 1. Start PostgreSQL & Redis

Using Docker (recommended):

```bash
docker compose up -d postgres redis
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# DATABASE_URL uses host port 5433 (docker-compose maps 5433→5432) so local Postgres on 5432 is left alone
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API listens on **http://localhost:4000**  
Swagger: **http://localhost:4000/api/docs**

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

UI: **http://localhost:5173** (proxies `/api` and `/socket.io` to `:4000` in dev).

### Demo user (after seed)

- **Email:** `demo@ussd.local`  
- **Password:** `demo-password`  

## Core API

### `POST /api/simulate` (primary)

Forwards a telecom-style payload to **your** callback.

- With **JWT**: send `profileId` referencing a saved webhook profile (`GET /api/profiles`).  
- **Anonymous** (local only): send `callbackUrl` when `ALLOW_ANONYMOUS_SIMULATE` is not `false`.

```json
{
  "sessionId": "optional-will-be-generated",
  "phoneNumber": "256700000000",
  "serviceCode": "*182#",
  "text": "1*2",
  "callbackUrl": "https://your-server.com/ussd",
  "provider": "DIALFORGE",
  "payloadMapping": { "phoneNumber": "msisdn" },
  "simulation": { "delayMs": 0, "retries": 0, "duplicate": false, "invalidInput": false }
}
```

Response includes `response` (`CON …` / `END …`), `ended`, `sessionId`, and an **`inspector`** object (outbound JSON, headers, latency, HTTP status).

### `POST /api/ussd`

Legacy alias — same body and behavior as `/api/simulate`.

### `POST /api/examples/mock-ussd`

Tiny **plain-text** mock USSD app bundled for local demos (`CON`/`END`). Point a profile or `callbackUrl` at `http://127.0.0.1:4000/api/examples/mock-ussd`.

### Webhook profiles

`GET/POST/PUT/DELETE /api/profiles` — save multiple named callbacks (method, headers, auth token, provider, field mapping, JSON response path, default delay/retries).

### Flow builder (`GET /api/flows/starter`)

Optional JSON template for the visual flow builder only — **not** executed by `/api/simulate`.

## Docker (full stack)

```bash
docker compose up --build
```

- Frontend: **http://localhost:5173** (nginx serving the Vite build)  
- Backend: **http://localhost:4000**  

Set strong `JWT_SECRET` in production compose overrides.

## Environment variables

### Backend (`backend/.env.example`)

- `DATABASE_URL` – PostgreSQL connection string  
- `REDIS_URL` – Redis connection string  
- `JWT_SECRET` – signing secret (min 16 chars)  
- `CORS_ORIGIN` – comma-separated allowed origins  
- `SESSION_TTL_SECONDS` – Redis session TTL (default `180`)  
- `WEBHOOK_TIMEOUT_MS` – outbound HTTP timeout  
- `ALLOW_ANONYMOUS_SIMULATE` – allow `callbackUrl` without JWT (default on; set `false` in production)  
- `SIMULATE_RATE_LIMIT_WINDOW_MS` / `SIMULATE_RATE_LIMIT_MAX` – per-IP window for `/api/simulate`  

### Frontend (`frontend/.env.example`)

- `VITE_API_URL` – API base URL (empty in dev uses Vite proxy)  
- `VITE_SOCKET_URL` – Socket.IO origin (empty uses current origin + proxy)  

## Security notes

This project is optimized for **local sandboxing**. Before exposing publicly:

- Rotate `JWT_SECRET`, database credentials, and Redis ACLs.  
- Disable anonymous simulate in production (`ALLOW_ANONYMOUS_SIMULATE=false`).  
- Harden callback verification on your own backends (signatures, allowlists).  

## License

MIT (adjust as needed for your organization).
