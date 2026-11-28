# Dependency Remediation Report

- Runtime tree previously resolved vulnerable `minimatch@10.2.6` through `expo@58.0.26` → `@expo/fingerprint@0.21.10`.
- Advisory GHSA-g3hv-75wg-m249 affects minimatch `<11.0.1` in the resolved advisory range.
- npm's suggested fix was an Expo SDK major downgrade to 52.0.49; rejected as incompatible and unsafe.
- Added a scoped `overrides` entry for `@expo/fingerprint` → `minimatch@11.0.1`; updated package-lock via npm and performed a clean `npm ci`.
- Expo 58 / React Native 0.88 versions remain unchanged. `npm explain minimatch` and npm audit were rerun; both full and production audits report zero vulnerabilities.
- Risk: override replaces the fingerprint package's declared minimatch major. Typecheck, unit suite, and production web build pass, but verify native fingerprint operations through EAS/native build before release. Remove/adjust override after upstream dependency is patched.