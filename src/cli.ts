#!/usr/bin/env node
import { parseArgs } from "node:util";
import { isProfile } from "./profiles.js";
import { validate } from "./validate.js";
import { annotation, textReport } from "./report.js";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      profile: { type: "string", default: "auto" },
      workspace: { type: "string" },
      format: { type: "string", default: "text" },
      "allow-empty": { type: "boolean" },
      "fail-on-warnings": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(`Usage: node dist/cli.cjs [paths...] [options]
  --profile auto|spec|claude|codex|gemini|opencode|openclaw|cursor
  --workspace PATH       Containment boundary (default: current directory)
  --format text|json|github
  --allow-empty          Allow zero discovered skills
  --fail-on-warnings     Treat warnings as a failed check
Paths are literal directories or SKILL.md files, relative to the workspace.
Without paths, scan standard skill roots at the workspace top level.`);
  } else {
    if (!isProfile(values.profile))
      throw new Error("Unknown --profile. Run --help for supported profiles.");
    if (!["text", "json", "github"].includes(values.format))
      throw new Error("Unknown --format. Use text, json, or github.");
    const result = validate({
      ...(positionals.length ? { paths: positionals } : {}),
      ...(values.workspace ? { workspace: values.workspace } : {}),
      profile: values.profile,
      allowEmpty: values["allow-empty"] ?? false,
      failOnWarnings: values["fail-on-warnings"] ?? false,
    });
    console.log(
      values.format === "json"
        ? JSON.stringify(result, null, 2)
        : values.format === "github"
          ? result.diagnostics.map(annotation).join("\n")
          : textReport(result),
    );
    process.exitCode = result.ok ? 0 : 1;
  }
} catch (error) {
  console.error(
    `skills-schema-lint: ${JSON.stringify(error instanceof Error ? error.message : String(error))}`,
  );
  process.exitCode = 2;
}
