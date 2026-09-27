import { LineCounter, isMap, isNode, parseDocument } from "yaml";
import { isMapping } from "./schemas/checks.js";
import { Limits, Rule, Severity, type Diagnostic } from "./types.js";

export interface ParsedMapping {
  values: Map<string, unknown>;
  location: (field: string) => { line: number; column: number };
}

/** Parse once, retain field locations, and never evaluate custom YAML tags. */
export function parseMapping(
  text: string,
  file: string,
  diagnostics: Diagnostic[],
  offset = 0,
): ParsedMapping | undefined {
  const counter = new LineCounter();
  const document = parseDocument(text, {
    lineCounter: counter,
    strict: true,
    uniqueKeys: true,
    version: "1.2",
    prettyErrors: false,
  });
  const report = (message: string, position = 0) => {
    const { line, col } = counter.linePos(position);
    diagnostics.push({
      file,
      line: line + offset,
      column: col,
      rule: Rule.Yaml,
      severity: Severity.Error,
      message,
    });
  };
  for (const issue of [...document.errors, ...document.warnings])
    report(issue.message, issue.pos[0]);
  if (document.errors.length || document.warnings.length) return;
  if (!isMap(document.contents)) {
    report("Expected a YAML mapping.");
    return;
  }
  let values: unknown;
  try {
    values = document.toJS({ mapAsMap: true, maxAliasCount: Limits.Aliases });
  } catch (error) {
    report(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!isMapping(values)) {
    report("Mapping keys must be strings.");
    return;
  }
  return {
    values,
    location(field) {
      const node = document.get(field, true);
      const position = isNode(node) ? node.range?.[0] : 0;
      const { line, col } = counter.linePos(position ?? 0);
      return { line: line + offset, column: col };
    },
  };
}

export function parseSkill(
  text: string,
  file: string,
  diagnostics: Diagnostic[],
) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const closing = lines.findIndex(
    (line, index) => index > 0 && /^---[ \t]*$/.test(line),
  );
  if (!/^---[ \t]*$/.test(lines[0] ?? "") || closing < 0) {
    diagnostics.push({
      file,
      line: 1,
      column: 1,
      rule: Rule.Yaml,
      severity: Severity.Error,
      message:
        "SKILL.md must begin with YAML frontmatter between standalone --- lines.",
    });
    return;
  }
  const frontmatter = lines.slice(1, closing).join("\n");
  if (Buffer.byteLength(frontmatter) > Limits.FrontmatterBytes) {
    diagnostics.push({
      file,
      line: 1,
      column: 1,
      rule: Rule.Limit,
      severity: Severity.Error,
      message: "Frontmatter exceeds the 64 KiB limit.",
    });
    return;
  }
  const parsed = parseMapping(frontmatter, file, diagnostics, 1);
  return parsed
    ? {
        ...parsed,
        body: lines.slice(closing + 1).join("\n"),
        bodyLine: closing + 2,
      }
    : undefined;
}
