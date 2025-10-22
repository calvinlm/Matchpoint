# Public Standings View

- Route: `/public/[slug]/standings`
- Fetches `GET /api/v1/public/:slug/standings` (unauthenticated).
- Each division renders its brackets with standings table showing entry code, team name, record (W/L), PF/PA, and quotient.
- Page auto-refreshes through React Query (`staleTime` 30s) and provides retry affordance on failure.
- Intended for kiosks/TVs; pairs with printable match sheets for on-site displays.

## Players Directory
- Route: `/public/[slug]/players`
- Fetches `GET /api/v1/public/:slug/players` (unauthenticated).
- Supports search across entry code, team name, and player names with debounced filtering.
- Lists each division’s registered teams with entry codes, optional seed notes, and roster details (DOB included when available).

## Queue Table
- Route: `/public/[slug]/table`
- Fetches `GET /api/v1/public/:slug/table` (unauthenticated) for live court assignments and bracket queues.
- Shows active courts with current matches, plus per-bracket queues grouped by division.
- Designed for large-display kiosks; auto-refresh configured via React Query stale time (15s).

## Kiosk Mode
- Append `?kiosk=1` (or `?kiosk=true`) to any `/public` route to enable large-format styles and faster auto-refresh.
- Search inputs and manual refresh controls are hidden in kiosk mode for passive displays.
- Public APIs emit short-lived cache headers (10–30s) to help CDN/browser caching; React Query stale times and kiosk refresh intervals align with these windows.

## Bracket Overview
- Route: `/public/[slug]/brackets`
- Fetches `GET /api/v1/public/:slug/brackets` (unauthenticated) providing bracket config, seedings, and match list.
- Displays seedings, round-by-round match groupings for elimination brackets, and group grids for round robin.
