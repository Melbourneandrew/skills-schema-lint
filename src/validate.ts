import fs from "node:fs";
import { Discovery } from "./discovery.js";
import { Corpus } from "./corpus.js";
import { defaultPaths, isProfile } from "./profiles.js";
import { errorMessage } from "./files.js";
import {
  Profile,
  Rule,
  Severity,
  type Diagnostic,
  type Options,
  type Result,
} from "./types.js";
export { Profile, Rule, Severity } from "./types.js";
export type { Options, Result, Diagnostic } from "./types.js";

function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  return (
    a.line - b.line ||
    a.column - b.column ||
    a.message.localeCompare(b.message, "en")
  );
}
function result(
  diagnostics: Diagnostic[],
  skillCount: number,
  start: number,
  failOnWarnings: boolean,
): Result {
  diagnostics.sort(compareDiagnostics);
  const errorCount = diagnostics.filter(
    (d) => d.severity === Severity.Error,
  ).length;
  const warningCount = diagnostics.length - errorCount;
  return {
    skillCount,
    errorCount,
    warningCount,
    diagnostics,
    durationMs: Math.round((performance.now() - start) * 100) / 100,
    ok: errorCount === 0 && (!failOnWarnings || warningCount === 0),
  };
}
function check(options: Options, diagnostics: Diagnostic[]): number {
  const profile = options.profile ?? Profile.Auto;
  if (!isProfile(profile))
    throw new Error(`Unknown profile: ${String(profile)}`);
  const workspace = fs.realpathSync(options.workspace ?? process.cwd());
  const files = new Discovery(workspace, profile, diagnostics).scan(
    options.paths ?? defaultPaths,
    options.paths !== undefined,
  );
  if (!files.length && !options.allowEmpty)
    throw new Error(
      "No SKILL.md files found. Set paths explicitly, or opt into allow-empty.",
    );
  const corpus = new Corpus(workspace, diagnostics);
  for (const skill of files) corpus.check(skill);
  return new Set(files.map((file) => file.realFile)).size;
}
export function validate(options: Options = {}): Result {
  const start = performance.now();
  const diagnostics: Diagnostic[] = [];
  let skillCount = 0;
  try {
    skillCount = check(options, diagnostics);
  } catch (error) {
    diagnostics.push({
      file: ".",
      line: 1,
      column: 1,
      rule: Rule.Discovery,
      severity: Severity.Error,
      message: errorMessage(error),
    });
  }
  return result(
    diagnostics,
    skillCount,
    start,
    options.failOnWarnings ?? false,
  );
}
