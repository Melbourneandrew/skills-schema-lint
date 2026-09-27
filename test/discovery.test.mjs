import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validate } from "../dist/index.cjs";
import { workspace, write, skill, check } from "./helpers.mjs";
for (const [directory, field] of [
  [".claude", "context: fork"],
  [".cursor", "disable-model-invocation: true"],
  [".openclaw", "homepage: https://example.com"],
])
  test(`auto detects ${directory}`, (t) => {
    const root = workspace(t);
    write(root, `${directory}/skills/example/SKILL.md`, skill(`${field}\n`));
    assert.equal(validate({ workspace: root }).errorCount, 0);
    assert.equal(validate({ workspace: root }).warningCount, 0);
  });
test("all standard roots discovered", (t) => {
  const root = workspace(t);
  for (const dir of [
    ".agents",
    ".claude",
    ".codex",
    ".gemini",
    ".opencode",
    ".openclaw",
    ".cursor",
  ])
    write(root, `${dir}/skills/example/SKILL.md`, skill());
  write(root, "skills/example/SKILL.md", skill());
  assert.equal(validate({ workspace: root }).skillCount, 8);
});
test("default scan is bounded to top-level roots; explicit monorepo paths work", (t) => {
  const root = workspace(t);
  write(root, "packages/app/.gemini/skills/example/SKILL.md", skill());
  assert.equal(validate({ workspace: root }).ok, false);
  assert.equal(
    validate({ workspace: root, paths: ["packages/app/.gemini/skills"] }).ok,
    true,
  );
});
test("empty discovery fails unless explicitly allowed", (t) => {
  const root = workspace(t);
  assert.equal(validate({ workspace: root }).ok, false);
  assert.equal(validate({ workspace: root, allowEmpty: true }).ok, true);
  assert.equal(
    validate({ workspace: root, paths: ["missing"], allowEmpty: true }).ok,
    false,
  );
});
test("literal file and directory arguments, overlaps deduplicated", (t) => {
  const root = workspace(t);
  write(root, "my skills/example/SKILL.md", skill());
  const result = validate({
    workspace: root,
    paths: ["my skills", "my skills/example/SKILL.md"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.skillCount, 1);
});
test("lowercase filename produces diagnostic", (t) => {
  const root = workspace(t);
  write(root, "skills/example/skill.md", skill());
  assert.equal(validate({ workspace: root }).ok, false);
});
test("ignored dependency directories do not pollute corpus", (t) => {
  const root = workspace(t);
  write(root, "skills/example/SKILL.md", skill());
  for (const dir of ["node_modules", ".git", ".venv", "dist"])
    write(root, `skills/${dir}/invalid/SKILL.md`, "invalid");
  assert.equal(validate({ workspace: root }).skillCount, 1);
  assert.equal(validate({ workspace: root }).ok, true);
});
test("diagnostics sorted and YAML locations point to values", (t) => {
  const root = workspace(t);
  write(root, "skills/z/SKILL.md", skill("", "z"));
  write(
    root,
    "skills/a/SKILL.md",
    "---\nname: a\ndescription: false\n---\nBody",
  );
  const result = validate({ workspace: root });
  assert.equal(result.diagnostics[0].line, 3);
  assert.equal(result.diagnostics[0].column, 14);
});
test("path traversal is rejected even with allow-empty", (t) => {
  const root = workspace(t);
  assert.equal(
    validate({ workspace: root, paths: [".."], allowEmpty: true }).ok,
    false,
  );
});
test("size bounds and invalid UTF-8", (t) => {
  const root = workspace(t);
  write(root, "skills/example/SKILL.md", Buffer.alloc(1024 * 1024 + 1, 65));
  assert.equal(validate({ workspace: root }).ok, false);
  write(
    root,
    "skills/example/SKILL.md",
    skill(`metadata:\n  large: ${"x".repeat(65536)}\n`),
  );
  assert.equal(validate({ workspace: root }).ok, false);
  write(root, "skills/example/SKILL.md", Buffer.from([0xff]));
  assert.equal(validate({ workspace: root }).ok, false);
});
// Junctions work without elevated Windows symlink privileges.
test("in-workspace aliases deduplicated and cycles rejected", (t) => {
  const root = workspace(t);
  write(root, ".agents/skills/example/SKILL.md", skill());
  fs.mkdirSync(path.join(root, ".codex"), { recursive: true });
  fs.symlinkSync(
    path.join(root, ".agents/skills"),
    path.join(root, ".codex/skills"),
    "junction",
  );
  assert.equal(validate({ workspace: root }).skillCount, 1);
  fs.symlinkSync(
    path.join(root, ".agents/skills"),
    path.join(root, ".agents/skills/loop"),
    "junction",
  );
  assert.equal(validate({ workspace: root }).ok, false);
});
test("aliases are still checked for each harness profile", (t) => {
  const root = workspace(t);
  write(root, ".claude/skills/example/SKILL.md", skill("context: fork\n"));
  fs.mkdirSync(path.join(root, ".agents"), { recursive: true });
  fs.symlinkSync(
    path.join(root, ".claude/skills"),
    path.join(root, ".agents/skills"),
    "junction",
  );
  assert.equal(validate({ workspace: root }).ok, false); // shared path must be portable
});
test("external symlink rejected", (t) => {
  const root = workspace(t),
    outside = workspace(t);
  write(outside, "example/SKILL.md", skill());
  fs.mkdirSync(path.join(root, "skills"));
  fs.symlinkSync(outside, path.join(root, "skills/external"), "junction");
  assert.equal(validate({ workspace: root }).ok, false);
});
test(
  "broken root symlink rejected",
  { skip: process.platform === "win32" },
  (t) => {
    const root = workspace(t);
    fs.symlinkSync(path.join(root, "missing"), path.join(root, "skills"));
    assert.equal(validate({ workspace: root, allowEmpty: true }).ok, false);
  },
);
test("unrecognized profile fails closed in API", (t) =>
  assert.equal(check(t, skill(), { profile: "typo" }).ok, false));

test("absolute paths work through a symlinked workspace path", (t) => {
  const parent = workspace(t);
  const real = path.join(parent, "real");
  write(real, "skills/example/SKILL.md", skill());
  const alias = path.join(parent, "alias");
  fs.symlinkSync(real, alias, "junction");
  assert.equal(
    validate({ workspace: alias, paths: [path.join(alias, "skills")] }).ok,
    true,
  );
});

test("excessively deep collections fail", (t) => {
  const root = workspace(t);
  write(root, `skills/${"x/".repeat(65)}example/SKILL.md`, skill());
  const result = validate({ workspace: root });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((d) => d.message.includes("64 levels")));
});
test("sidecars cannot escape the workspace through a directory symlink", (t) => {
  const root = workspace(t),
    outside = workspace(t);
  write(root, "skills/example/SKILL.md", skill());
  write(outside, "openai.yaml", "policy: {allow_implicit_invocation: true}");
  fs.symlinkSync(outside, path.join(root, "skills/example/agents"), "junction");
  assert.equal(validate({ workspace: root }).ok, false);
});
