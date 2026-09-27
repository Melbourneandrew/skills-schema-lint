import fs from "node:fs";
import { isProfile } from "./profiles.js";
import { validate, Profile } from "./validate.js";
import { annotation, escapeCommand, summary } from "./report.js";

function input(name: string): string {
  return (process.env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
}
function booleanInput(name: string): boolean {
  const value = input(name);
  if (value && value !== "true" && value !== "false")
    throw new Error(`${name} must be true or false.`);
  return value === "true";
}
try {
  const profile = input("profile") || Profile.Auto;
  if (!isProfile(profile)) throw new Error(`Unknown profile: ${profile}`);
  const paths = input("paths")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const result = validate({
    workspace: process.env["GITHUB_WORKSPACE"] ?? process.cwd(),
    ...(paths.length ? { paths } : {}),
    profile,
    allowEmpty: booleanInput("allow-empty"),
    failOnWarnings: booleanInput("fail-on-warnings"),
  });
  // Bound log volume; counts still include every diagnostic.
  for (const diagnostic of result.diagnostics.slice(0, 100))
    console.log(annotation(diagnostic));
  if (result.diagnostics.length > 100)
    console.log(
      "Showing the first 100 diagnostics. Run the CLI with --format json for all diagnostics.",
    );
  console.log(summary(result));
  if (process.env["GITHUB_OUTPUT"])
    fs.appendFileSync(
      process.env["GITHUB_OUTPUT"],
      `skills-checked=${result.skillCount}\nerrors=${result.errorCount}\nwarnings=${result.warningCount}\nduration-ms=${result.durationMs}\n`,
    );
  if (process.env["GITHUB_STEP_SUMMARY"])
    fs.appendFileSync(
      process.env["GITHUB_STEP_SUMMARY"],
      `## Skills schema lint\n\n${summary(result)}\n`,
    );
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.log(
    `::error::${escapeCommand(error instanceof Error ? error.message : String(error))}`,
  );
  process.exitCode = 1;
}
