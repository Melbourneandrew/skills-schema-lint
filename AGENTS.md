# Development rules

## Small, cohesive source modules

- Split code diligently by responsibility: filesystem discovery, YAML parsing,
  schema primitives, each harness schema, reporting, and entry points belong in
  separate modules. Split tests by the behavior they prove.
- Extract a cohesive module before a file becomes difficult to review. The
  500-line ceiling is a hard limit, not a target. Aim well below it.
- Keep cyclomatic complexity at or below 10 per function. Use named operations
  and declarative schema tables. Do not hide complexity in compressed lines,
  nested expressions, lint suppressions, or arbitrary wrapper functions.
- Preserve readable names and control flow. Avoid generic frameworks that make
  a small validation rule harder to follow.

## Strict correctness

- TypeScript strict mode, unchecked indexed access, exact optional properties,
  and type-aware ESLint checks are mandatory. Do not introduce `any`, unchecked
  type assertions, non-null assertions, or disable comments to bypass a check.
- Treat skill files as untrusted data. Never execute scripts or dynamic content,
  make network requests during validation, or read outside the workspace.
- Add regression tests for schema boundaries, new harness rules, and failure
  paths. Keep official references and compatibility limitations in the README.
- Every harness profile checks the portable core plus documented extensions.
  It does not emulate permissive loader fallbacks or prove runtime behavior.

## Build and verify

- The action is built into **one self-contained `dist/action.cjs` file**. Source
  splitting must not add runtime imports or installation steps for consumers.
- `dist/cli.cjs` and `dist/index.cjs` are separate CLI/library entry points; the
  action does not load them. Generated bundles are exempt from source line limits.
- Keep all build-time dependencies exact and locked. The bundled YAML parser is
  third-party code; preserve its notice and never advertise zero third-party code.
- Run `npm ci`, `npm run check`, `npm run bench`, and `git diff --exit-code -- dist`
  after committing generated files. CI verifies Linux, macOS, Windows, action
  success/failure paths, and reproducible bundles.
- Do not weaken tests or lint thresholds to get a green build. Fix the design.
- Work on branches. Open a PR, inspect its diff and CI, and merge only after all
  required verification passes. Tag releases only from verified main commits.
