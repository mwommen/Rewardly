# Release Workflow

## Validation

Run:

```bash
npm run verify:epic-011
```

This checks repository hygiene, backend build/tests, shared package build,
frontend build, extension syntax, and mobile type/lint checks.

For targeted identity validation, run:

```bash
npm run backend:auth:test
```

## Repository Hygiene

Run:

```bash
npm run check:repo-hygiene
```

The check fails if tracked files include generated reports, `.env` files,
build output, `node_modules`, obvious secret patterns, or files larger than
10 MB.

## Generated Reports

Large generated JSON reports must stay ignored. Commit markdown summaries for
human review instead.
