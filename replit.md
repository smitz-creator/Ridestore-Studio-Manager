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

### Visual Design
Dark theme with fixed sidebar navigation. Background: warm medium-dark grey (`#2e2e2e`), cards: slightly lighter (`#383838`), sidebar: darker grey (`#262626`) with emerald accent. All status badges use translucent dark variants (e.g. `bg-green-900/30 text-green-400`). Fixed 240px sidebar on desktop with logo, general nav, role-specific nav (separated by divider), and user controls at bottom. Mobile uses collapsible slide-down menu.

### Users
Simple name-pick login (no passwords): Smitz, Oskar, Issa, Philip, Nordén, Agnes

### Features
- **Login**: Pick your name from a list, stored in localStorage
- **Dashboard**: Project progress bars (8-stage pipeline), shot coverage stats, factory-delayed warnings, upcoming/past studio sessions
- **Projects**: Each has a name, brand (Dope Snow/Montec), and season (e.g. FW25). Shows product count and upload progress with 8-stage segmented bar
- **Products** (within a project): Each tracks Gender, Product Type, Shortname (model name), Style, Design, Key Code, Colour. Shot types: Gallery Shots, Details Shots, Misc Shots (text fields). Delivery Status (Not Ordered, Ordered, In Transit, Delayed at Factory, Delivered/In GBG). Factory Delayed flag. Upload Status is an 8-stage pipeline: Not Started (grey #9ca3af) → In the Studio (cyan #06b6d4) → Ready for Selection (pink #ec4899) → Ready for Retouch (orange #f97316) → In Post Production (blue #3b82f6) → Post Production - Done (purple #8b5cf6) → Ready for Upload (yellow #eab308) → Uploaded (green #22c55e). Expandable rows with inline editing.
- **Filtering**: Gender, product type, model name, delivery status, upload status, shot missing (gallery/details/misc/missing required), delayed only, reshoot only, text search
- **Bulk Selection & Editing**: Select All (respects current filters), individual row checkboxes, floating action bar with Change Upload Status, Change Delivery Status, Toggle Factory Delayed, Remove Reshoot, Clear Selection
- **Missing Shots Quality Gate**: When upload status is set to "Ready for Upload" or beyond, products missing required shots (Gallery for all types; Gallery + Details for Jackets/Pants) are automatically reverted to "Not Started" with an amber badge. Works for both single and bulk updates. Badge auto-disappears when shots are filled in. **Carry Over products bypass the quality gate entirely.**
- **Carry Over**: Products reused from a previous season can be tagged as "Carry Over" (blue badge). Carry-over products are exempt from missing-shots warnings and quality gate enforcement. Toggle in expanded product detail, bulk toggle in action bar. Filterable via "Shot Missing → Carry Over". Excluded from "Missing Required" filter results.
- **Comments**: Any user can comment on a product, showing who and when
- **Capture Sessions**: Auto-collected from Gallery/Details/Misc shot fields across all products. Groups products by session name and shot type. Shows parsed dates from session names. Expandable to show product table. "Change status for all" bulk updates.
- **Excel Import**: Upload .xlsx files to bulk-import products. Multi-sheet support: previews all sheets, lets user pick which to import, auto-detects season from filename. Creates one project per selected sheet. Sheet names map to brands: DOPE→Dope Snow, MONTEC→Montec. Also supports per-project import.
- **Studio Sessions ("Photo Shoots")**: Guided wizard booking flow — Step 1: Shot Type → Step 2: Brand → Step 3: Gender → Step 4: Product Type → Step 5: Products (filtered by previous selections, with Select All/Clear and individual checkboxes) → Step 6: Details (Date, Model-Product, Notes). Products are associated with sessions via `session_products` junction table. Edit modal pre-fills all wizard steps including pre-checked products. Product count shown on session cards.
- **Shooting Mode**: Multi-step guided workflow for live studio shoot days. Step 1: Pick Brand → Gender → Product Type with big tappable buttons, auto-generates session name (format: BRAND_GENDER_TYPE_FWyy_DD.MM). Step 2: Select products (filtered by brand/gender/type, excludes factory-delayed, model filter). Step 3: Live tracking with G/D/M/CO toggle buttons per product card. Step 4: Session complete — closing session auto-moves ticked products to "Ready for Selection", reverts unticked products to previous status. Carry Over products auto-show CO ticked.
- **Selection Mode** (Philip only): Dedicated view at `/selection` for reviewing shot sessions. Shows products at "Ready for Selection" grouped by Gallery Shots session name. Collapsible session cards with progress indicators. Individual tick-off or "Complete Session" bulk action moves products to "Ready for Retouch". Sessions disappear when all products are selected. Access-guarded: nav item hidden and page redirects non-Philip users.
- **Naming Tracker** (Oskar & Agnes only): Dedicated view at `/naming` for file renaming and asset verification. Shows products at "Post Production Done" grouped by Gallery Shots session name. Same layout as Selection — collapsible session cards, individual tick-off or "Complete Session" bulk action moves products to "Ready for Upload". CO products auto-promoted. Yellow color scheme.
- **Upload Tracker** (Oskar only): Final pipeline step at `/upload`. Shows products at "Ready for Upload" grouped by session name. Tick-off moves products to "Uploaded". CO auto-promoted. Green color scheme. Emerald nav button.
- **Retouch Tracker** (Smitz only): Dedicated post-production hub at `/retouch` with two sections. **Ready for Retouch**: tick-off products (individually or "Complete Session") to move to "In Post Production"; CO products auto-promoted. **In Post Production**: session cards with "Send to Pixelz"/"Send to Masking" buttons (sets badge + "Waiting" state), carry-over product highlighting (blue bold key codes), copy CO key codes (individual + bulk), "Carry Overs Sourced" checkbox, "Done" button (enabled only when session is in Waiting mode) moves all products to "Post Production Done". Session metadata stored in `retouch_sessions` DB table.
- **Studio Planner**: Weekly calendar view (Mon-Fri, 52 weeks). Rows: Photo, Philip, Smitz, Oskar, Agnes. Colored block categories (Gallery=green, Details=blue, Mixed=purple, Retouch=orange, Deadline=red, Meeting=grey, Other=yellow, Holiday=dark grey+strikethrough). Milestone banners span full week header. Photo shoots auto-sync to Photo row. Click cells to add blocks, click blocks to edit/delete. Show/hide past weeks, jump to current week.

### Database Tables
- `users`: id, name, created_at
- `projects`: id, name, brand, season, created_at, updated_at
- `products`: id, project_id (FK), gender, product_type, shortname, style, design, key_code, colour, gallery_shots, details_shots, misc_shots, delivery_status, factory_delayed, is_reshoot, is_carry_over, upload_status, created_at, updated_at
- `comments`: id, product_id (FK), user_id (FK), text, created_at
- `studio_sessions`: id, date, model_name, brand, shot_type, notes, created_by_id, created_at
- `session_products`: id, session_id (FK→studio_sessions), product_id (FK→products), created_at. Unique constraint on (session_id, product_id).
- `retouch_sessions`: id, session_name (unique), sent_to (pixelz/masking/null), carry_overs_sourced (bool), created_at, updated_at
- `planner_blocks`: id, week_number, year, day_index, row, label, category, is_milestone, linked_session_id

### API Endpoints (under /api)
- `GET /users` — list all users
- `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` — project CRUD with product stats (8 pipeline stages + shot coverage)
- `GET/POST /products`, `GET/PATCH/DELETE /products/:id` — product CRUD with filtering
- `POST /projects/:id/import` — Excel file upload into existing project
- `POST /import/preview` — Preview all sheets in an Excel file
- `POST /import/execute` — Import selected sheets, creating projects per sheet
- `GET/POST /products/:productId/comments` — comments per product
- `GET/POST /sessions`, `PATCH/DELETE /sessions/:id` — studio session CRUD with product association
- `GET /sessions/:id/products` — products linked to a session
- `GET /wizard/products` — all products with brand (from project) for booking wizard
- `GET /capture-sessions` — auto-collected sessions from product shot fields with status breakdowns
- `PATCH /capture-sessions/bulk-status` — bulk update upload status for multiple products (supports all 8 statuses)
- `PATCH /products/bulk-update` — bulk update products (upload status, delivery status, factory delayed, reshoot). Validates required shots when setting to "Ready for Upload" — reverts products missing shots to "Not Started" and returns reverted product details.
- `GET /dashboard` — upcoming/past sessions for dashboard
- `GET /planner/blocks?year=2026` — planner blocks for a year
- `POST /planner/blocks` — create planner block
- `PATCH /planner/blocks/:id` — update planner block
- `DELETE /planner/blocks/:id` — delete planner block

### Frontend Pages
- `/` — Login (if not authenticated) or Dashboard
- `/projects` — Projects list with Import Excel
- `/projects/:id` — Project detail with products, filtering, comments
- `/shooting-mode` — Multi-step guided shooting workflow
- `/capture-sessions` — Auto-grouped capture sessions
- `/sessions` — Studio sessions management ("Photo Shoots")
- `/planner` — Studio Planner weekly calendar (Mon-Fri, rows for Photo/Philip/Smitz/Oskar/Agnes, colored block categories, milestones, auto-synced photo shoots)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files emitted during typecheck

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`. Uses `@workspace/db` for persistence.
- Routes: users, projects, products, comments, sessions, health, dashboard, import, capture-sessions, planner

### `artifacts/studio-app` (`@workspace/studio-app`)

React + Vite frontend. Uses wouter for routing, React Query for data fetching, shadcn/ui components.
- Custom API client in `src/lib/api.ts`
- Auth context in `src/lib/auth.tsx`

### `lib/db` (`@workspace/db`)

Drizzle ORM with PostgreSQL. Schema files in `src/schema/`:
- users.ts, projects.ts, products.ts, comments.ts, studio-sessions.ts, session-products.ts, retouch-sessions.ts, planner-blocks.ts

Development: `pnpm --filter @workspace/db run push` (or `push-force`)
