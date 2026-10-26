# API Status (SODA Frontend)

## Active backend integrations

- Auth: `POST /api/auth/login`
- Sales: `GET /api/sales`
- Sales route history: `GET /api/sales/route-history` (LASKA; OLGATORG returns 501)
- Uploads: `POST /api/upload/photos`

## Frontend modules mapped to active backend

- `auth.ts`: login/session role mapping
- `client.ts`: shared HTTP/JWT client
- `fetchOlgatorgSales.ts`: normalized OLGATORG sales list
- `saveReport.ts`: photo uploads
- `saveStoreCheck.ts`: photo uploads for StoreCheck
- `fetchOlgatorgRoutes.ts`: OLGATORG route view model derived from sales (no extra endpoint)
- `fetchOlgatorgStoreSelectorData.ts`: OLGATORG selector data derived from sales

## Grouped API entrypoints

- `live/index.ts`: exports all active backend integrations
- `limited/index.ts`: exports integrations that are intentionally
  disabled/degraded

## Temporarily limited modules (backend endpoints missing)

- `messages.ts`: returns empty/no-op responses
- `planTargets.ts`: throws explicit "not implemented" error
- `fetchReports.ts`: returns empty list; delete unsupported
- `fetchStoreCheckReports.ts`: returns empty list

## Feature-flagged in UI

- `src/config/backendFeatures.ts` controls visibility of degraded sections:
  - Gallery
  - Messages
  - Plan Targets
  - StoreCheck Create
  - StoreCheck Review

## Removed as obsolete

- `addStore.ts`
- `sheetApi.ts`
- `types/sheet.ts`
- `components/NewStoreModal/*`

## Backend TODO for full parity

- Messages endpoints (list/send/feedback/mark-read)
- Plan targets endpoints (load/save)
- StoreCheck metrics save endpoint
- Reports list/delete endpoints
- Store create endpoint
