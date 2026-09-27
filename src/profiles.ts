import path from "node:path";
import { Profile, type ResolvedProfile } from "./types.js";
export const defaultPaths = [
  ".agents/skills",
  ".claude/skills",
  ".codex/skills",
  ".gemini/skills",
  ".opencode/skills",
  ".openclaw/skills",
  ".cursor/skills",
  "skills",
];
const profiles = new Map<string, ResolvedProfile>([
  [".claude", Profile.Claude],
  [".codex", Profile.Codex],
  [".gemini", Profile.Gemini],
  [".opencode", Profile.OpenCode],
  [".openclaw", Profile.OpenClaw],
  [".cursor", Profile.Cursor],
]);
export function isProfile(value: unknown): value is Profile {
  return Object.values(Profile).some((profile) => profile === value);
}
export function inferProfile(file: string): ResolvedProfile {
  const parts = file.split(path.sep);
  for (let i = parts.length - 2; i >= 0; i--) {
    const profile = profiles.get(parts[i] ?? "");
    if (parts[i + 1] === "skills" && profile) return profile;
  }
  return Profile.Spec;
}
