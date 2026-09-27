import path from "node:path";
import {
  Profile,
  Rule,
  Severity,
  type Diagnostic,
  type ResolvedProfile,
} from "./types.js";
import type { ParsedMapping } from "./yaml.js";
import { fields, type Shape } from "./schemas/checks.js";
import { standard } from "./schemas/standard.js";
import { cursor } from "./schemas/cursor.js";
import { claude } from "./schemas/claude.js";
import { openclaw, validateDispatch } from "./schemas/openclaw.js";
import { codexSidecar } from "./schemas/codex.js";
const extensions: Record<ResolvedProfile, Shape> = {
  spec: {},
  claude,
  codex: {},
  gemini: {},
  opencode: {},
  openclaw,
  cursor,
};
const schemas = Object.fromEntries(
  Object.entries(extensions).map(([profile, extra]) => [
    profile,
    { ...standard, ...extra },
  ]),
);

function reporter(
  parsed: ParsedMapping,
  file: string,
  diagnostics: Diagnostic[],
  rule: Rule = Rule.Field,
) {
  return (
    field: string,
    message: string,
    severity: Severity = Severity.Error,
  ) => {
    const rootField = field.split(/[.[]/)[0] ?? field;
    diagnostics.push({
      file,
      ...parsed.location(rootField),
      rule,
      severity,
      message,
    });
  };
}
function canonicalName(name: string, profile: ResolvedProfile): string {
  return profile === Profile.OpenCode ? name : name.normalize("NFKC");
}
function validateName(
  name: string,
  file: string,
  profile: ResolvedProfile,
  report: ReturnType<typeof reporter>,
) {
  const normalized = canonicalName(name, profile);
  if (normalized !== name && [...normalized].length > 64)
    report("name", "Normalized name must be at most 64 characters.");
  const pattern =
    profile === Profile.OpenCode
      ? /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      : /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
  if (
    normalized !== normalized.toLowerCase() ||
    !pattern.test(normalized) ||
    name !== name.trim()
  )
    report(
      "name",
      "name must use lowercase letters, numbers, and single interior hyphens (ASCII for OpenCode).",
    );
  if (normalized !== canonicalName(path.basename(path.dirname(file)), profile))
    report("name", "name must match the parent directory name.");
}
function unknownFields(
  parsed: ParsedMapping,
  shape: Shape,
  file: string,
  diagnostics: Diagnostic[],
  severity: Severity,
) {
  const report = reporter(parsed, file, diagnostics, Rule.UnknownField);
  for (const field of parsed.values.keys())
    if (!Object.hasOwn(shape, field))
      report(field, `Unknown field: ${field}.`, severity);
}
export function validateSchema(
  parsed: ParsedMapping,
  file: string,
  profile: ResolvedProfile,
  diagnostics: Diagnostic[],
): string | undefined {
  const shape = schemas[profile] ?? standard;
  unknownFields(
    parsed,
    shape,
    file,
    diagnostics,
    profile === Profile.Spec ? Severity.Error : Severity.Warning,
  );
  const report = reporter(parsed, file, diagnostics);
  fields(parsed.values, shape, "", report);
  if (profile === Profile.OpenClaw)
    validateDispatch(parsed.values, "command-tool", report);
  if (profile === Profile.OpenCode && parsed.values.has("allowed-tools"))
    report(
      "allowed-tools",
      "OpenCode does not list allowed-tools among its recognized skill fields.",
      Severity.Warning,
    );
  const name = parsed.values.get("name");
  if (typeof name !== "string") return undefined;
  validateName(
    name,
    file,
    profile,
    reporter(parsed, file, diagnostics, Rule.Name),
  );
  return name.normalize("NFKC");
}
export function validateSidecar(
  parsed: ParsedMapping,
  file: string,
  diagnostics: Diagnostic[],
) {
  unknownFields(parsed, codexSidecar, file, diagnostics, Severity.Warning);
  fields(
    parsed.values,
    codexSidecar,
    "",
    reporter(parsed, file, diagnostics, Rule.Sidecar),
  );
}
