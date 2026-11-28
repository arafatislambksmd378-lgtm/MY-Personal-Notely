# Test Results

Recorded during production-hardening work (2026-11-28):

| Check | Result |
|---|---|
| `npm ci` | Pass, reproducible install from updated lockfile |
| `npm run typecheck` | Pass, zero TypeScript errors |
| `npm test` | Pass: 156 passed; 11 skipped in live-sync suite (integration env gated) |
| `npm run lint` | Not clean: 55 warnings remain, zero errors. Safe autofixes removed duplicate imports, import ordering and array-style warnings; React hooks/ref patterns and unused drawing state remain. |
| `npm run build:web` | Pass, Expo web bundle exported to dist |
| `npm audit` | Pass, zero known findings after scoped override |
| `npm audit --omit=dev` | Pass, zero known production findings |
| `npx expo-doctor` | 18/20 passed; Expo config schema and RN Directory checks unable to fetch external services (not verified) |
| `git diff --check` | Pass at time of prior check; rerun after final documentation changes |

The editor tests print jsdom canvas `getContext()` not implemented warnings despite passing. Live sync tests require dedicated Supabase test configuration and were not represented as passing. No device/emulator functional tour was run in this session.