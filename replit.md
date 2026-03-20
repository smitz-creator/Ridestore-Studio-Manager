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
- **Dashboard**: Project progress bars (8-stage pipeline), shot coverage stats, factory-delayed warnings, upcoming/past studio sessions
- **Projects**: Each has a name, brand (Dope Snow/Montec), and season (e.g. FW25). Shows product count and upload progress with 8-stage segmented bar
- **Products** (within a project): Each tracks Gender, Product Type, Shortname (model name), Style, Design, Key Code, Colour. Shot types: Gallery Shots, Details Shots, Misc Shots (text fields). Delivery Status (Not Ordered, Ordered, In Transit, Delayed at Factory, Delivered/In GBG). Factory Delayed flag. Upload Status is an 8-stage pipeline: Not Started (grey #9ca3af) → In the Studio (cyan #06b6d4) → Ready for Selection (pink #ec4899) → Ready for Retouch (orange #f97316) → In Post Production (blue #3b82f6) → Post Production - Done (purple #8b5cf6) → Ready for Upload (yellow #eab308) → Uploaded (green #22c55e). Expandable rows with inline editing.
- **Filtering**: Gender, product type, model name, delivery status, upload status, shot missing (gallery/details/misc), delayed only, text search
- **Comments**: Any user can comment on a product, showing who and when
- **Capture Sessions**: Auto-collected from Gallery/Details/Misc shot fields across all products. Groups products by session name and shot type. Shows parsed dates from session names. Expandable to show product table. "Change status for all" bulk updates.
- **Excel Import**: Upload .xlsx files to bulk-import products. Multi-sheet support: previews all sheets, lets user pick which to import, auto-detects season from filename. Creates one project per selected sheet. Sheet names map to brands: DOPE→Dope Snow, MONTEC→Montec. Also supports per-project import.
- **Studio Sessions ("Photo Shoots")**: Book sessions with date, model name, brand, shot type, notes.
- **Shooting Mode**: Multi-step guided workflow for live studio shoot days. Step 1: Pick Brand → Gender → Product Type with big tappable buttons, auto-generates session name (format: BRAND_GENDER_TYPE_FWyy_DD.MM). Step 2: Select products (filtered by brand/gender/type, excludes factory-delayed, model filter). Step 3: Live tracking with checkboxes — entering sets products to "In the Studio", ticking off sets to "Ready for Selection". Step 4: Session complete — continue with different products or close (reverts unchecked products to previous status).

### Database Tables
- `users`: id, name, created_at
- `projects`: id, name, brand, season, created_at, updated_at
- `products`: id, project_id (FK), gender, product_type, shortname, style, design, key_code, colour, gallery_shots, details_shots, misc_shots, delivery_status, factory_delayed, upload_status, created_at, updated_at
- `comments`: id, product_id (FK), user_id (FK), text, created_at
- `studio_sessions`: id, date, model_name, brand, shot_type, notes, created_by_id, created_at

### API Endpoints (under /api)
- `GET /users` — list all users
- `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` — project CRUD with product stats (8 pipeline stages + shot coverage)
- `GET/POST /products`, `GET/PATCH/DELETE /products/:id` — product CRUD with filtering
- `POST /projects/:id/import` — Excel file upload into existing project
- `POST /import/preview` — Preview all sheets in an Excel file
- `POST /import/execute` — Import selected sheets, creating projects per sheet
- `GET/POST /products/:productId/comments` — comments per product
- `GET/POST /sessions`, `DELETE /sessions/:id` — studio session CRUD
- `GET /capture-sessions` — auto-collected sessions from product shot fields with status breakdowns
- `PATCH /capture-sessions/bulk-status` — bulk update upload status for multiple products (supports all 8 statuses)
- `GET /dashboard` — upcoming/past sessions for dashboard

### Frontend Pages
- `/` — Login (if not authenticated) or Dashboard
- `/projects` — Projects list with Import Excel
- `/projects/:id` — Project detail with products, filtering, comments
- `/shooting-mode` — Multi-step guided shooting workflow
- `/capture-sessions` — Auto-grouped capture sessions
- `/sessions` — Studio sessions management ("Photo Shoots")

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files emitted during typecheck

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`. Uses `@workspace/db` for persistence.
- Routes: users, projects, products, comments, sessions, health, dashboard, import, capture-sessions

### `artifacts/studio-app` (`@workspace/studio-app`)

React + Vite frontend. Uses wouter for routing, React Query for data fetching, shadcn/ui components.
- Custom API client in `src/lib/api.ts`
- Auth context in `src/lib/auth.tsx`

### `lib/db` (`@workspace/db`)

Drizzle ORM with PostgreSQL. Schema files in `src/schema/`:
- users.ts, projects.ts, products.ts, comments.ts, studio-sessions.ts

Development: `pnpm --filter @workspace/db run push` (or `push-force`)
