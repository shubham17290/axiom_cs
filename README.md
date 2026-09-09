# GATE CS & IT PYQ Practice Platform

Monorepo foundation for a full-stack web application that helps **GATE CS & IT aspirants** practice Previous Year Questions subject-wise and topic-wise, track performance, and improve systematically (Practice → Analyze → Improve loop).

> **Status: Phase 6 foundation only.** No application features are implemented yet. The architecture (database, API, frontend) is specified in the approved design documents under [`docs/`](./docs).

## Prerequisites

- **Node.js** ≥ 20 (tested on v24) and **npm** ≥ 10
- **PostgreSQL** ≥ 14 (for Phase 7; not required to run the foundation server)
- **Git** for version control

## Project Structure

```
.
├── apps/
│   ├── backend/          # Express + TypeScript + Prisma (Phase 4 architecture)
│   │   └── data/raw/     # Immutable raw GATE CS PYQ PDFs (parser/ingestion inputs)
│   └── frontend/         # Next.js (React) + TypeScript + Tailwind CSS (Phase 5)
├── docs/                 # Approved design documents (Phases 0–5)
├── package.json          # npm workspaces root
└── .env.example          # Environment variable reference
```

## Setup

1. **Install dependencies** (install the whole monorepo):

   ```bash
   npm install
   ```

2. **Configure environment**: copy the template and fill in values.

   ```bash
   cp .env.example .env
   ```

   > `.env` is git-ignored. Never commit real secrets.

3. **Start the development servers**:

   ```bash
   npm run dev            # runs backend + frontend together
   # or individually:
   npm run dev:backend    # http://localhost:4000  (GET /health)
   npm run dev:frontend   # http://localhost:3000
   ```

4. **Database (Phase 7)**: the Prisma foundation lives in `apps/backend/prisma/`. The full Phase 3 schema is added later. Until then:
   ```bash
   # validate/generate the Prisma client (needs DATABASE_URL in env)
   $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gate_pyq"
   npm run prisma:validate --workspace backend
   npm run prisma:generate --workspace backend
   ```

## Scripts

| Script (root)                          | Description                                     |
| -------------------------------------- | ----------------------------------------------- |
| `npm run dev`                          | Run backend + frontend dev servers concurrently |
| `npm run dev:backend` / `dev:frontend` | Run a single workspace dev server               |
| `npm run build`                        | Production build for all workspaces             |
| `npm run lint`                         | ESLint for all workspaces                       |
| `npm run typecheck`                    | `tsc --noEmit` for all workspaces               |
| `npm run format`                       | Prettier format (`format:check` to verify)      |

## Environment Variables

See `.env.example` for the full annotated list:

| Variable                   | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string (Prisma)                |
| `PORT`                     | Backend API port (default 4000)                      |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL, from the browser's perspective |
| `NODE_ENV`                 | `development` / `test` / `production`                |

## Roadmap

- **Phase 7** — implement the approved Phase 3 database schema (Prisma) + first real migrations
- Later phases — API implementation (Phase 4), UI screens (Phase 5 design), and features per the PRD
