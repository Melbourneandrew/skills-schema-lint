import type { Diagnostic, Result } from "./types.js";
export function escapeCommand(value: string, property = false): string {
  const escaped = value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
  return property
    ? escaped.replaceAll(":", "%3A").replaceAll(",", "%2C")
    : escaped;
}
export function annotation(diagnostic: Diagnostic): string {
  return `::${diagnostic.severity} file=${escapeCommand(diagnostic.file, true)},line=${diagnostic.line},col=${diagnostic.column},title=${escapeCommand(diagnostic.rule, true)}::${escapeCommand(diagnostic.message)}`;
}
export function summary(result: Result): string {
  return `${result.skillCount} skills checked, ${result.errorCount} errors, ${result.warningCount} warnings (${result.durationMs} ms)`;
}
export function textReport(result: Result): string {
  return [
    ...result.diagnostics.map(
      (d) =>
        `${JSON.stringify(d.file)}:${d.line}:${d.column} ${d.severity} [${d.rule}] ${JSON.stringify(d.message)}`,
    ),
    summary(result),
  ].join("\n");
}
