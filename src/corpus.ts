import fs from "node:fs";
import path from "node:path";
import { readBounded, exists, errorMessage } from "./files.js";
import { parseMapping, parseSkill } from "./yaml.js";
import { validateSchema, validateSidecar } from "./schema.js";
import { Rule, Severity, type Diagnostic } from "./types.js";
import type { SkillFile } from "./discovery.js";

type ParsedSkill = NonNullable<ReturnType<typeof parseSkill>>;
export class Corpus {
  private readonly names = new Map<
    string,
    { realFile: string; file: string }
  >();
  private readonly contents = new Map<string, string>();
  private readonly sidecars = new Set<string>();
  constructor(
    private readonly workspace: string,
    private readonly diagnostics: Diagnostic[],
  ) {}
  check(skill: SkillFile) {
    const file = path.relative(this.workspace, skill.file);
    try {
      this.checkSkill(skill, file);
    } catch (error) {
      this.error(file, error);
    }
  }
  private error(file: string, error: unknown) {
    this.diagnostics.push({
      file,
      line: 1,
      column: 1,
      rule: Rule.Discovery,
      severity: Severity.Error,
      message: errorMessage(error),
    });
  }
  private checkSkill(skill: SkillFile, file: string) {
    let text = this.contents.get(skill.realFile);
    if (text === undefined) {
      text = readBounded(skill.file, this.workspace);
      this.contents.set(skill.realFile, text);
    }
    const parsed = parseSkill(text, file, this.diagnostics);
    if (!parsed) return;
    const name = validateSchema(parsed, file, skill.profile, this.diagnostics);
    if (name) this.name(name, skill, file, parsed);
    this.body(parsed, file, text);
    this.sidecar(path.join(path.dirname(skill.file), "agents", "openai.yaml"));
  }
  private name(
    name: string,
    skill: SkillFile,
    file: string,
    parsed: ParsedSkill,
  ) {
    const previous = this.names.get(name);
    if (previous && previous.realFile !== skill.realFile) {
      this.diagnostics.push({
        file,
        ...parsed.location("name"),
        rule: Rule.Duplicate,
        severity: Severity.Warning,
        message: `Skill name also exists in ${previous.file}; harness precedence differs.`,
      });
    } else this.names.set(name, { realFile: skill.realFile, file });
  }
  private body(parsed: ParsedSkill, file: string, text: string) {
    if (!parsed.body.trim())
      this.diagnostics.push({
        file,
        line: parsed.bodyLine,
        column: 1,
        rule: Rule.Body,
        severity: Severity.Warning,
        message: "Skill has no Markdown instructions.",
      });
    if (text.split("\n").length > 500)
      this.diagnostics.push({
        file,
        line: 1,
        column: 1,
        rule: Rule.Body,
        severity: Severity.Warning,
        message:
          "SKILL.md exceeds the recommended 500 lines; consider extracting references.",
      });
  }
  private sidecar(sidecar: string) {
    const file = path.relative(this.workspace, sidecar);
    try {
      if (!exists(sidecar)) return;
      const real = fs.realpathSync(sidecar);
      if (this.sidecars.has(real)) return;
      this.sidecars.add(real);
      const parsed = parseMapping(
        readBounded(sidecar, this.workspace),
        file,
        this.diagnostics,
      );
      if (parsed) validateSidecar(parsed, file, this.diagnostics);
    } catch (error) {
      this.error(file, error);
    }
  }
}
