# Release Checklist

## Current status: BLOCKED — NOT PRODUCTION READY

- [x] Lockfile install (`npm ci`)
- [x] TypeScript check
- [x] Unit test suite (156 pass; 11 integration cases skipped)
- [ ] ESLint zero warnings (still outstanding)
- [x] Dependency audit (zero reported advisories after scoped minimatch override)
- [x] Web production export
- [ ] Expo Doctor all checks verified (2 checks blocked by network)
- [ ] Live sync integration suite with isolated backend
- [ ] Android signed release build + install/upgrade/data-retention verification
- [ ] iOS release build verification if iOS is a target
- [ ] Accessibility and low-end device performance validation
- [ ] Hosting security headers, deep-link refresh and production environment verified
- [ ] Backup/restore and sync recovery confirmed on real supported devices
- [ ] Review final diff and obtain explicit release/deployment authorization

Do not mark a release ready while any applicable item above remains unchecked.