# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## App: Ridestore Studio Photography Tracker

An e-commerce product photography tracking tool for Ridestore, managing products across brands (Dope Snow, Montec) and seasons.

### Users
Simple name-pick login (no passwords): Smitz, Oskar, Issa, Philip, Nordén

### Features
- **Login**: Pick your name from a list, stored in localStorage
- **Dashboard**: Project progress bars, factory-delayed warnings, upcoming/past studio sessions
- **Projects**: Each has a name, brand (Dope Snow/Montec), and season (e.g. FW25). Shows product count and upload progress
- **Products** (within a project): Each tracks Gender, Product Type, Shortname (model name), Style, Design, Key Code, Colour. Shot types: Gallery Shots, Details Shots, Misc Shots (text fields). Delivery Status (Not Ordered, Ordered, In Transit, Delayed at Factory, Delivered/In GBG). Factory Delayed flag. Upload Status (Not Started, In Progress, Uploaded). Expandable rows with inline editing.
- **Filtering**: Gender, product type, model name, delivery status, upload status, shot missing (gallery/details/misc), delayed only, text search
- **Comments**: Any user can comment on a product, showing who and when
- **Studio Sessions**: Book sessions with date, model name, brand, shot type, notes. Shows upcoming and past sessions.

### Database Tables
- `users`: id, name, created_at
- `projects`: id, name, brand, season, created_at, updated_at
- `products`: id, project_id (FK), gender, product_type, shortname, style, design, key_code, colour, gallery_shots, details_shots, misc_shots, delivery_status, factory_delayed, upload_status, created_at, updated_at
- `comments`: id, product_id (FK), user_id (FK), text, created_at
- `studio_sessions`: id, date, model_name, brand, shot_type, notes, created_by_id, created_at

### API Endpoints (under /api)
- `GET /users` — list all users
- `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` — project CRUD with product stats
- `GET/POST /products`, `GET/PATCH/DELETE /products/:id` — product CRUD with filtering
- `GET/POST /products/:productId/comments` — comments per product
- `GET/POST /sessions`, `DELETE /sessions/:id` — studio session CRUD
- `GET /dashboard` — upcoming/past sessions for dashboard

### Frontend Pages
- `/` — Login (if not authenticated) or Dashboard
- `/projects` — Projects list
- `/projects/:id` — Project detail with products, filtering, comments
- `/sessions` — Studio sessions management

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files emitted during typecheck

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`. Uses `@workspace/db` for persistence.
- Routes: users, projects, products, comments, sessions, health, dashboard

### `artifacts/studio-app` (`@workspace/studio-app`)

React + Vite frontend. Uses wouter for routing, React Query for data fetching, shadcn/ui components.
- Custom API client in `src/lib/api.ts`
- Auth context in `src/lib/auth.tsx`

### `lib/db` (`@workspace/db`)

Drizzle ORM with PostgreSQL. Schema files in `src/schema/`:
- users.ts, projects.ts, products.ts, comments.ts, studio-sessions.ts

Development: `pnpm --filter @workspace/db run push` (or `push-force`)
