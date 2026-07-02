# Contributor Contract

This repository's complete contributor contract — architecture, conventions,
critical rules, the Pre-Ship Checklist, and the Single-Sources-of-Truth
correlation map — lives in **[CLAUDE.md](./CLAUDE.md)**.

Read it fully before changing anything. Every convention in it is mandatory
and mechanically enforced: `npm run lint` (eslint + theme-token guard),
`npx tsc --noEmit`, and `npm test` (519+ tests including schema invariant
guards and i18n completeness) fail loudly on violations.

Gates before every commit:

```
npm run lint && npx tsc --noEmit && npm test && npm run build
```
