# Deployment Guide (Readiness Notes)

## Web
1. Set user-managed Supabase URL/public anon key and sync settings through the application's cloud-sync settings; do not commit secrets. Never expose a service-role key in a client build.
2. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npm audit`, and `npm run build:web` in CI.
3. Publish the generated `dist/` only through an approved static host. Configure SPA/history fallback for Expo Router deep links and HTTPS. Configure host-level security headers (CSP tailored/tested for Expo web assets, HSTS, `X-Content-Type-Options`, frame restrictions, and referrer policy); this repository does not control the hosting headers.
4. Test refresh/deep-link behavior, backup/export flows, and cloud sync against a non-production project before production rollout.

## Android / iOS
The project contains Expo native modules, but this work did not generate or install a release binary. Before release, confirm app identifier/version, permissions, signing credentials, EAS profiles, native module compatibility, and upgrade/data retention using a signed internal build. Preserve the existing identifier. No credentials or publishing actions are included here.

No production deployment or app-store release has been performed.