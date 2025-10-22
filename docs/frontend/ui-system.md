# UI System — Tailwind + shadcn/ui

- The Next.js frontend now uses Tailwind CSS (configured via `tailwind.config.ts`) with CSS variables for theming. Global styles live in `app/globals.css`.
- shadcn/ui primitives are stored under `components/ui/` and rely on `@/lib/utils` for the `cn` helper (`tailwind-merge` + `clsx`).
- Add new components by following the structure in `components.json`. Place shared UI under `components/ui/` and import via the `@/components` alias.
- Tailwind content scanning covers `app/**`, `src/**`, and `components/**`. Remember to restart `next dev` after adding new glob locations.
- Use the provided primitives (`Button`, `Card`, `Input`, `Label`, `Badge`, `Separator`, `Switch`, `Alert`, `Skeleton`) when building new screens to keep spacing and typography consistent.
