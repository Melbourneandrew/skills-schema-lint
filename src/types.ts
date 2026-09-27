export const Profile = {
  Auto: "auto",
  Spec: "spec",
  Claude: "claude",
  Codex: "codex",
  Gemini: "gemini",
  OpenCode: "opencode",
  OpenClaw: "openclaw",
  Cursor: "cursor",
} as const;
export type Profile = (typeof Profile)[keyof typeof Profile];
export type ResolvedProfile = Exclude<Profile, "auto">;
export const Severity = { Error: "error", Warning: "warning" } as const;
export type Severity = (typeof Severity)[keyof typeof Severity];
export const Rule = {
  Discovery: "discovery",
  Yaml: "yaml",
  Field: "field",
  Name: "name",
  UnknownField: "unknown-field",
  Body: "body",
  Duplicate: "duplicate-name",
  Sidecar: "sidecar",
  Limit: "limit",
} as const;
export type Rule = (typeof Rule)[keyof typeof Rule];
export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  rule: Rule;
  severity: Severity;
  message: string;
}
export interface Options {
  workspace?: string;
  paths?: string[];
  profile?: Profile;
  allowEmpty?: boolean;
  failOnWarnings?: boolean;
}
export interface Result {
  skillCount: number;
  errorCount: number;
  warningCount: number;
  diagnostics: Diagnostic[];
  durationMs: number;
  ok: boolean;
}
export const Limits = {
  FileBytes: 1024 * 1024,
  FrontmatterBytes: 64 * 1024,
  Entries: 100_000,
  Depth: 64,
  Aliases: 50,
} as const;
