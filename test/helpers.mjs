import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validate } from "../dist/index.cjs";
export function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skills-schema-lint-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
export function write(root, file, contents) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), contents);
}
export const skill = (
  fields = "",
  name = "example",
  body = "Follow these instructions.",
) =>
  `---\nname: ${name}\ndescription: Test a skill schema.\n${fields}---\n${body}\n`;
export function check(t, content, options = {}) {
  const root = workspace(t);
  write(root, ".agents/skills/example/SKILL.md", content);
  return validate({ workspace: root, ...options });
}
