# Security Audit Report

## Dependency findings and remediation
The initial npm audit showed three moderate findings, all from the same advisory (GHSA-g3hv-75wg-m249, minimatch globparts amplification, affected range `>=7.0.0 <11.0.1`). `npm explain minimatch` identified the relevant production chain: `expo` → `@expo/fingerprint` → minimatch, with `@expo/fingerprint` requesting `^10.2.6`. npm's suggested automatic fix would downgrade Expo to 52.0.49, so it was not used. Instead, a scoped override pins `@expo/fingerprint`'s minimatch to patched 11.0.1 while retaining the installed Expo 58 / React Native 0.88 line. `npm ci`, `npm audit`, and `npm audit --omit=dev` subsequently completed with zero reported vulnerabilities.

The full dependency tree also has separate development-only minimatch copies (for ESLint tooling); npm reports no current advisories for those installed versions.

## Application security review
Reviewed configuration, storage/sync service references and SQL schema locations at source level. This was not a formal penetration test or backend policy verification. Cloud sync credentials must be configured by the user; never put real project tokens in source or CI logs. The repository's Supabase RLS policy/schema and token handling require a real isolated project review before enabling production sync. No secrets were intentionally added in this work.

## Residual risks
- npm audit cannot establish safe server-side Supabase policies, account controls, or production credential rotation.
- No live security testing, Android network-security inspection, or deployment-header verification was run.
- Keep the scoped override only while compatible; review it when updating Expo/fingerprint and rerun complete tests.