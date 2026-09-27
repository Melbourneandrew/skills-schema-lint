import fs from "node:fs";
import path from "node:path";
import { contains, errorMessage, exists } from "./files.js";
import { inferProfile } from "./profiles.js";
import {
  Limits,
  Profile,
  Rule,
  Severity,
  type Diagnostic,
  type ResolvedProfile,
} from "./types.js";
const ignored = new Set([
  ".git",
  "node_modules",
  ".venv",
  "vendor",
  "dist",
  "build",
  "coverage",
]);
export interface SkillFile {
  file: string;
  realFile: string;
  profile: ResolvedProfile;
}
class EntryLimit extends Error {}

/** Scoped synchronous traversal, with independent cycle and alias detection. */
export class Discovery {
  private readonly found: SkillFile[] = [];
  private readonly seen = new Set<string>();
  private entries = 0;
  constructor(
    private readonly workspace: string,
    private readonly profile: Profile,
    private readonly diagnostics: Diagnostic[],
  ) {}

  scan(roots: string[], explicit: boolean): SkillFile[] {
    for (const root of roots) {
      const file = path.resolve(this.workspace, root);
      try {
        if (!explicit && !exists(file)) continue;
        this.visit(file, new Set(), 0);
      } catch (error) {
        this.report(file, errorMessage(error));
      }
      if (this.entries > Limits.Entries) break;
    }
    return this.found;
  }
  private report(file: string, message: string) {
    this.diagnostics.push({
      file: path.relative(this.workspace, file) || ".",
      line: 1,
      column: 1,
      rule: Rule.Discovery,
      severity: Severity.Error,
      message,
    });
  }
  private resolveProfile(file: string): ResolvedProfile {
    return this.profile === Profile.Auto ? inferProfile(file) : this.profile;
  }
  private visit(file: string, ancestors: Set<string>, depth: number) {
    if (++this.entries > Limits.Entries)
      throw new EntryLimit(
        "Discovery exceeds 100,000 entries; select narrower paths.",
      );
    if (depth > Limits.Depth)
      throw new Error("Directory nesting exceeds 64 levels.");
    const real = fs.realpathSync(file);
    if (!contains(this.workspace, real))
      throw new Error("Path resolves outside the workspace.");
    const stat = fs.statSync(real);
    if (stat.isDirectory()) this.directory(file, real, ancestors, depth);
    else this.file(file, real, stat.isFile(), depth);
  }
  private file(file: string, real: string, regular: boolean, depth: number) {
    const name = path.basename(file);
    if (regular && name === "SKILL.md") {
      const profile = this.resolveProfile(file);
      const key = `file:${real}:${profile}`;
      if (!this.seen.has(key)) {
        this.seen.add(key);
        this.found.push({ file, realFile: real, profile });
      }
    } else if (/^skill\.md$/i.test(name))
      this.report(file, "Use the exact filename SKILL.md and a regular file.");
    else if (depth === 0)
      this.report(
        file,
        "A path must be a skill directory, skill collection, or SKILL.md file.",
      );
  }
  private directory(
    file: string,
    real: string,
    ancestors: Set<string>,
    depth: number,
  ) {
    if (ancestors.has(real)) throw new Error("Symbolic link cycle detected.");
    const key = `dir:${real}:${this.resolveProfile(path.join(file, "_"))}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    const next = new Set(ancestors).add(real);
    const entries = fs
      .readdirSync(real, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      if (!this.relevant(entry)) continue;
      const child = path.join(file, entry.name);
      try {
        this.visit(child, next, depth + 1);
      } catch (error) {
        if (error instanceof EntryLimit) throw error;
        this.report(child, errorMessage(error));
      }
    }
  }
  private relevant(entry: fs.Dirent): boolean {
    return (
      !ignored.has(entry.name) &&
      (entry.isDirectory() ||
        entry.isSymbolicLink() ||
        /^skill\.md$/i.test(entry.name))
    );
  }
}
