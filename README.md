# Skills Schema Lint

[![CI](https://github.com/Melbourneandrew/skills-schema-lint/actions/workflows/ci.yml/badge.svg)](https://github.com/Melbourneandrew/skills-schema-lint/actions/workflows/ci.yml)

Fast, offline schema checks for `SKILL.md` files across **Claude Code, Codex,
Gemini CLI, OpenCode, OpenClaw, and Cursor**.

- One bundled JavaScript action. No `npm install`, Python, Docker, network calls,
  or agent installation in your validation step.
- TypeScript source, strict types, small modules, and readable schema tables.
- A proven YAML parser, bundled at build time. **Zero runtime installation
  dependencies**, not zero third-party code.
- File/line annotations, numeric outputs, and a job summary.

## Use in GitHub Actions

```yaml
name: Skills
on: [push, pull_request]
permissions:
  contents: read
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: Melbourneandrew/skills-schema-lint@v1
```

No token or additional permissions are needed. Pin the action to the full commit
SHA from a release for immutable builds. `v1` tracks compatible releases.

For shared portable skills, select the standard explicitly:

```yaml
- uses: Melbourneandrew/skills-schema-lint@v1
  with:
    paths: |
      .agents/skills
      packages/frontend/.agents/skills
    profile: spec
    fail-on-warnings: "true"
```

OpenClaw's workspace `skills/` directory is ambiguous with generic skill
collections, so explicitly choose its profile:

```yaml
- uses: Melbourneandrew/skills-schema-lint@v1
  with:
    paths: skills
    profile: openclaw
```

### Inputs

| Input              | Default   | Meaning                                                                                                      |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------------ |
| `paths`            | automatic | Newline-separated **literal** directories or `SKILL.md` files, relative to the workspace. No glob expansion. |
| `profile`          | `auto`    | `spec`, `claude`, `codex`, `gemini`, `opencode`, `openclaw`, `cursor`, or `auto`.                            |
| `allow-empty`      | `false`   | Permit zero discovered skills. Missing explicit paths and other discovery errors still fail.                 |
| `fail-on-warnings` | `false`   | Fail on advisory findings as well as errors.                                                                 |

Boolean inputs accept `true` or `false`. Unknown profiles and malformed inputs
fail the action.

### Outputs

| Output           | Meaning                                                    |
| ---------------- | ---------------------------------------------------------- |
| `skills-checked` | Distinct physical `SKILL.md` files checked                 |
| `errors`         | Schema, YAML, or discovery errors                          |
| `warnings`       | Advisory findings                                          |
| `duration-ms`    | Validation time; excludes Node startup and action download |

### Discovery

Automatic discovery checks these roots **at the workspace top level**:

```text
.agents/skills    .claude/skills    .codex/skills    .gemini/skills
.opencode/skills  .openclaw/skills  .cursor/skills   skills
```

Traversal within a root is recursive, including grouped collections. Nested
monorepo roots and plugin directories can be passed in `paths`. This explicit
boundary avoids walking an entire repository merely to find skill roots.

In `auto`, the closest recognized harness directory selects its profile.
`.agents/skills`, plain `skills`, and custom paths use `spec`. `.codex/skills` is
included for existing repositories; the current Codex documentation recommends
`.agents/skills`. User home directories are never scanned automatically.

Symlinks within the workspace are followed. Physical files are counted once;
aliases with different harness profiles are checked against each profile. Cycles,
broken symlinks, and paths resolving outside the workspace fail. Discovery skips
`.git`, `node_modules`, `.venv`, `vendor`, `dist`, `build`, and `coverage` below a
selected root. Use `paths` to select a normally excluded directory explicitly.
Only exact `SKILL.md` casing is accepted.

## What gets checked

### Portable core

The [Agent Skills specification](https://agentskills.io/specification) is the
baseline: required string fields, name syntax and directory equality, 64-character
names, 1–1024-character descriptions, 1–500-character compatibility declarations,
optional license/tool strings, and metadata string maps. Unknown top-level fields
fail in `spec` mode. Unicode names are NFKC-normalized for matching; OpenCode adds
its documented ASCII restriction. Lengths count Unicode code points.

YAML is parsed with the bundled [`yaml`](https://eemeli.org/yaml/) library, with
unique mapping keys and bounded alias expansion. Block scalars, multiline text,
quotes, flow collections, anchors, BOM, and CRLF are supported. Parse errors,
unresolved tags/aliases, non-string field keys, and parser warnings fail clearly.
Scalar types are retained: quote numeric metadata values when strings are needed.

Empty bodies, files exceeding 500 lines, and duplicate names in distinct physical
files are **warnings**. Duplicate names can be intentional overrides; precedence
varies by harness. A schema check does not grade instruction quality.

### Harness profiles and compatibility boundaries

Every profile validates the portable core, then its supported extensions. These
are authoring checks, **not exact emulations of permissive agent loaders**.
Unknown top-level fields in harness profiles warn; `fail-on-warnings` makes those
findings fatal. Arbitrary extra metadata is permitted for Claude and OpenClaw.

| Profile    | Additional checks                                                                                                                       | Deliberate boundary                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude`   | Invocation booleans, argument/tool/path strings or lists, model/agent hints, effort choices, fork context, shell choices, hooks mapping | Requires portable name/description and directory equality even though Claude can infer or override them. Requires real YAML booleans. Hook internals and tool permissions are not simulated.          |
| `codex`    | Portable core; optional `agents/openai.yaml` fields, policy boolean, and dependency tool declarations                                   | Sidecar is checked wherever present, including shared roots. No connector availability, icon-file existence, or runtime tool authorization checks.                                                    |
| `gemini`   | Portable core, including multiline descriptions                                                                                         | No activation, consent, extension manifest, or precedence simulation.                                                                                                                                 |
| `opencode` | ASCII names; warns that `allowed-tools` is not a documented recognized field                                                            | Does not parse `opencode.json` permissions.                                                                                                                                                           |
| `openclaw` | Invocation flags, tool dispatch, nested `metadata.openclaw` gating, OS lists, requirement arrays, installer kinds/required arguments    | Accepts YAML mapping metadata, including JSON-style flow mappings. Quoted JSON5 metadata strings and loader fallback parsing are not supported. Does not install tools or evaluate environment gates. |
| `cursor`   | Invocation boolean, paths, icon string, badge color choices                                                                             | No glob matching or Custom Mode execution.                                                                                                                                                            |

The Codex sidecar's known field types are checked; unknown top-level sections
warn. Nested future extension fields are retained without validation. OpenClaw
installer validation checks structure, not URLs, packages, archives, or binaries.
License and tool declarations are checked as strings, not as SPDX or tool grammars.

### Operational limits

Validation reads files only; it never runs skill scripts, shell snippets, hooks,
or body instructions. It makes no network requests. Reads are capped at 1 MiB per
file, frontmatter at 64 KiB, traversal at 64 directory levels and 100,000 visited
candidates, and YAML alias expansion at the parser's limit of 50. Limits are
validator policy, not Agent Skills requirements. Run against a stable checkout;
concurrent filesystem mutation is outside the supported model.

The action prints at most 100 annotations; output counts include all findings.
The CLI JSON report includes all diagnostics. Annotation messages and properties
are escaped so input text cannot create extra workflow commands. This tool is a
schema linter, not a security scanner or proof that a skill's instructions are safe.

## Local CLI and library

Clone this repository; the committed bundles run directly with Node.js 24+:

```sh
node dist/cli.cjs --help
node dist/cli.cjs .agents/skills --profile spec
node dist/cli.cjs skills --profile openclaw --format json
node dist/cli.cjs --workspace /path/to/repository --fail-on-warnings
```

CLI formats: `text`, `json`, `github`. Exit codes: `0` pass, `1` validation failure,
`2` invalid CLI invocation. Paths containing spaces are ordinary quoted arguments.

```js
const { validate } = require("./dist/index.cjs");
const result = validate({
  workspace: process.cwd(),
  paths: [".agents/skills"],
  profile: "spec",
});
console.log(result.ok, result.diagnostics);
```

This repository publishes a GitHub Action and downloadable source bundles. It is
not currently an npm registry package.

## Performance

One process, synchronous local file reads, scoped discovery, cached physical-file
contents, and no runtime setup. Source modules are bundled into a single
`dist/action.cjs`; the CLI and library bundles are separate entry points that the
action does not load. TypeScript types are erased during the build.

Example measurement on an Apple M3 Max, macOS ARM64, Node 26.5.0:

| Generated skills | Warm validation median | Fresh Node process median |
| ---------------: | ---------------------: | ------------------------: |
|               10 |                2.53 ms |                  66.89 ms |
|              100 |               16.03 ms |                  88.44 ms |
|            1,000 |              148.93 ms |                 244.29 ms |

The action is approximately 130 KB uncompressed. These are measurements, not a
speed guarantee or a comparison against other linters. Filesystem caches were
warm; medians use five runs after one warmup. Fresh-process timings include Node
startup. Runner provisioning, checkout, and action download are excluded.

Reproduce with `npm run build && npm run bench`. Linux CI also logs a benchmark
on Node 24. Timings are informational to avoid flaky hardware-dependent gates.

## Verification

`npm run check` runs strict TypeScript, type-aware ESLint, formatting, a fresh
bundle build, and Node's test runner. Tests cover:

- Portable constraints and boundary lengths, Unicode normalization, actual YAML
  types, duplicate keys, multiline/flow syntax, aliases, and malformed input.
- Positive and negative cases for harness extensions and the Codex sidecar.
- Recursive discovery, aliases, cycles, external paths, missing paths, filename
  casing, invalid UTF-8, size limits, duplicates, and empty-result policy.
- CLI exit codes and formats; action inputs, outputs, summaries, failure paths,
  annotation escaping, and running the bundle without `node_modules`.
- Actual rejection of excessive complexity and overlong source files by ESLint.

[CI](https://github.com/Melbourneandrew/skills-schema-lint/actions/workflows/ci.yml)
runs on Linux, macOS, and Windows with Node 24. Separate action jobs invoke the
committed bundle **without installing dependencies**, assert a valid fixture
passes, and assert an invalid fixture fails with the expected outputs. A
[release smoke workflow](.github/workflows/release-smoke.yml) imports the published
`@v1` action on all three platforms.

The original repository-local corpus was also checked read-only: 61 skills,
zero schema errors, and one body-length advisory. No private skill contents are
included here. Tests verify documented schema behavior; they do not launch the
six agents or claim exhaustive compatibility with every agent version.

## Research, references, and precedents

Reviewed **2026-09-27**. Upstream documentation changes; these references explain
the decisions and the limits of the compatibility claims.

| Primary reference or precedent                                                                                                                                                                                                                                                                                    | What was examined and how it informed this action                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Agent Skills specification](https://agentskills.io/specification)                                                                                                                                                                                                                                                | Portable format and naming rules; mandatory constraints are errors, while authoring recommendations are advisories.                                                                                                                                     |
| [skills-ref validator, pinned source](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref/src/skills_ref/validator.py) and [parser](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref/src/skills_ref/parser.py) | Reference implementation's Unicode/NFKC naming behavior. It accepts lowercase filenames and uses StrictYAML's scalar model; this action requires exact casing and typed YAML. Source review, not a claim of identical behavior.                         |
| [Anthropic quick validator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/quick_validate.py)                                                                                                                                                                                        | Six-field allowlist precedent. Its angle-bracket restriction is not imposed as a universal standard rule. No source was copied.                                                                                                                         |
| [Claude Code skill reference](https://code.claude.com/docs/en/skills#frontmatter-reference)                                                                                                                                                                                                                       | Native extension fields, loader defaults, tool lists, and differences between Claude Code and portable skill uploads. Profile tests cover the supported field types and choices.                                                                        |
| [Codex / ChatGPT skill documentation](https://learn.chatgpt.com/docs/build-skills)                                                                                                                                                                                                                                | Shared `.agents/skills` discovery, symlink support, and the `agents/openai.yaml` example. Tests cover interface, policy, and dependency shapes.                                                                                                         |
| [Gemini overview](https://geminicli.com/docs/cli/skills/) and [authoring guide](https://geminicli.com/docs/cli/creating-skills/)                                                                                                                                                                                  | `.gemini`/`.agents` roots and multiline YAML descriptions. Its consent and precedence behavior are runtime concerns.                                                                                                                                    |
| [OpenCode skills](https://opencode.ai/docs/skills/)                                                                                                                                                                                                                                                               | Documented ASCII name regex, field recognition, paths, and string-map metadata.                                                                                                                                                                         |
| [OpenClaw skills](https://docs.openclaw.ai/tools/skills)                                                                                                                                                                                                                                                          | Workspace roots, native flags, YAML-first parsing, nested metadata, gating, and installer declarations. Schema tests cover the documented shapes supported here.                                                                                        |
| [Cursor skills](https://cursor.com/docs/skills)                                                                                                                                                                                                                                                                   | Recursive collections, shared roots, invocation control, path scoping, and badge metadata.                                                                                                                                                              |
| [Official TypeScript Action template](https://github.com/actions/typescript-action)                                                                                                                                                                                                                               | JavaScript action packaging and checked-in distribution precedent. This repository was built independently with a smaller toolchain and no Actions SDK.                                                                                                 |
| [GitHub action metadata](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax)                                                                                                                                                                                                      | `node24`, inputs, outputs, and branding.                                                                                                                                                                                                                |
| [GitHub workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)                                                                                                                                                                                                  | Annotations and environment-file outputs; command escaping is regression-tested.                                                                                                                                                                        |
| [YAML parser documentation](https://eemeli.org/yaml/)                                                                                                                                                                                                                                                             | Strict parsing, source locations, duplicate-key detection, and alias limits. Bundled third-party license is in `dist/THIRD-PARTY-NOTICES.txt`.                                                                                                          |
| [thedaviddias/skill-check](https://github.com/thedaviddias/skill-check)                                                                                                                                                                                                                                           | Related action/CLI, broader linting, and optional security scanning. README reviewed; no comparative benchmark run.                                                                                                                                     |
| [agent-ecosystem/skill-validator](https://github.com/agent-ecosystem/skill-validator)                                                                                                                                                                                                                             | Related structural and quality checks. Scope precedent; no comparative benchmark run.                                                                                                                                                                   |
| Existing SF Platform validator (internal)                                                                                                                                                                                                                                                                         | Read-only review of a TypeScript/YAML/Markdown validator with composite setup. This action independently implements portable and harness schemas, ships a ready-to-run bundle, and does not export repository-specific Markdown policy or private code. |

No affiliation with or certification by the harness vendors is implied.

## Development and releases

```sh
npm ci
npm run check
npm run bench
```

Source layout:

```text
src/
  schemas/       Small declarative schemas and reusable type checks
  discovery.ts   Scoped filesystem traversal and alias handling
  files.ts       Bounded reads and path containment
  yaml.ts        Parsing and source locations
  schema.ts      Profile selection and cross-field validation
  corpus.ts      Per-skill checks and duplicate-name advisories
  validate.ts    Public validation API and result aggregation
  action.ts      Thin GitHub Actions adapter
  cli.ts         Thin command-line adapter
  report.ts      Text and workflow-command formatting
```

[AGENTS.md](AGENTS.md) requires diligent code splitting. ESLint enforces a maximum
cyclomatic complexity of **10**, maximum nesting depth **4**, and **500 lines per
source/test/script file**, including comments and blank lines. Generated bundles
are exempt. Strict TypeScript includes unchecked indexed access and exact
optional properties. CI verifies that rebuilding produces the committed bundles.

See [RELEASING.md](RELEASING.md). The repository includes a license, action
metadata, branding, and release instructions for
[Marketplace publication](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace).
A tagged public action can be imported immediately; a Marketplace listing is a
separate GitHub publication step requiring the owner's acceptance of its terms.

## License

MIT. The bundled YAML parser retains its own MIT notice in
[dist/THIRD-PARTY-NOTICES.txt](dist/THIRD-PARTY-NOTICES.txt).
