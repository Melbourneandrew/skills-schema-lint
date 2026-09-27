import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { workspace, write, skill } from "./helpers.mjs";
const cli = path.resolve("dist/cli.cjs");
const action = path.resolve("dist/action.cjs");
function run(entry, cwd, args = [], env = {}) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 10_000,
  });
}
function environment(root, extras = {}) {
  return {
    GITHUB_WORKSPACE: root,
    GITHUB_OUTPUT: path.join(root, "output"),
    GITHUB_STEP_SUMMARY: path.join(root, "summary"),
    INPUT_PROFILE: "auto",
    INPUT_PATHS: "",
    "INPUT_ALLOW-EMPTY": "false",
    "INPUT_FAIL-ON-WARNINGS": "false",
    ...extras,
  };
}
test("CLI text, JSON, GitHub and usage exit codes", (t) => {
  const root = workspace(t);
  write(root, ".agents/skills/example/SKILL.md", skill());
  assert.equal(run(cli, root).status, 0);
  const json = run(cli, root, ["--format", "json"]);
  assert.equal(JSON.parse(json.stdout).skillCount, 1);
  assert.equal(run(cli, root, ["--help"]).status, 0);
  assert.equal(run(cli, root, ["--profile", "typo"]).status, 2);
  assert.equal(run(cli, root, ["--format", "typo"]).status, 2);
  assert.equal(run(cli, root, ["--unknown"]).status, 2);
  write(root, ".agents/skills/example/SKILL.md", skill("", "other"));
  assert.equal(run(cli, root).status, 1);
  assert.match(run(cli, root, ["--format", "github"]).stdout, /::error file=/);
});
test("CLI workspace, literal paths and warnings gate", (t) => {
  const root = workspace(t);
  write(root, "my skills/example/SKILL.md", skill("", "example", ""));
  assert.equal(
    run(cli, process.cwd(), ["--workspace", root, "my skills"]).status,
    0,
  );
  assert.equal(run(cli, root, ["my skills", "--fail-on-warnings"]).status, 1);
  assert.equal(run(cli, workspace(t), ["--allow-empty"]).status, 0);
});
test("action succeeds and writes declared numeric outputs", (t) => {
  const root = workspace(t);
  write(root, ".agents/skills/example/SKILL.md", skill());
  const result = run(action, root, [], environment(root));
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const output = fs.readFileSync(path.join(root, "output"), "utf8");
  assert.match(
    output,
    /skills-checked=1\nerrors=0\nwarnings=0\nduration-ms=\d/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "summary"), "utf8"),
    /1 skills checked/,
  );
});
test("action fails malformed schemas and records error outputs", (t) => {
  const root = workspace(t);
  write(
    root,
    ".agents/skills/example/SKILL.md",
    "---\nname: example\n---\nBody",
  );
  const result = run(action, root, [], environment(root));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /::error file=.*line=2/);
  assert.match(fs.readFileSync(path.join(root, "output"), "utf8"), /errors=1/);
});
test("action honors explicit paths and profile", (t) => {
  const root = workspace(t);
  write(root, "custom/example/SKILL.md", skill("context: fork\n"));
  const result = run(
    action,
    root,
    [],
    environment(root, { INPUT_PATHS: "custom\n", INPUT_PROFILE: "claude" }),
  );
  assert.equal(result.status, 0, result.stdout);
});
test("action rejects invalid inputs, empty scans, and unreadable output paths", (t) => {
  const root = workspace(t);
  assert.equal(run(action, root, [], environment(root)).status, 1);
  assert.equal(
    run(action, root, [], environment(root, { "INPUT_ALLOW-EMPTY": "true" }))
      .status,
    0,
  );
  assert.equal(
    run(action, root, [], environment(root, { "INPUT_ALLOW-EMPTY": "yes" }))
      .status,
    1,
  );
  assert.equal(
    run(action, root, [], environment(root, { INPUT_PROFILE: "typo" })).status,
    1,
  );
  assert.equal(
    run(
      action,
      root,
      [],
      environment(root, {
        "INPUT_ALLOW-EMPTY": "true",
        GITHUB_OUTPUT: path.join(root, "missing/out"),
      }),
    ).status,
    1,
  );
});
test("action warning gate", (t) => {
  const root = workspace(t);
  write(root, ".agents/skills/example/SKILL.md", skill("", "example", ""));
  assert.equal(
    run(
      action,
      root,
      [],
      environment(root, { "INPUT_FAIL-ON-WARNINGS": "true" }),
    ).status,
    1,
  );
});
test("untrusted diagnostic text cannot inject workflow commands", (t) => {
  const root = workspace(t);
  write(
    root,
    ".agents/skills/example/SKILL.md",
    skill('"evil\\n::notice::injected,%": value\n'),
  );
  const result = run(action, root, [], environment(root));
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /\n::notice::injected/);
  assert.match(result.stdout, /%0A::notice::injected,%25/);
});
test(
  "annotation property filenames escape commas and colons",
  { skip: process.platform === "win32" },
  (t) => {
    const root = workspace(t);
    write(root, "skills/bad,:name/SKILL.md", skill());
    const result = run(action, root, [], environment(root));
    assert.match(result.stdout, /bad%2C%3Aname/);
  },
);
test("published action is a standalone script without node_modules", (t) => {
  const root = workspace(t);
  fs.copyFileSync(action, path.join(root, "action.cjs"));
  write(root, ".agents/skills/example/SKILL.md", skill());
  assert.equal(
    run(path.join(root, "action.cjs"), root, [], environment(root)).status,
    0,
  );
  assert.equal(fs.existsSync(path.join(root, "node_modules")), false);
});
test("CLI never executes code from skill text", (t) => {
  const root = workspace(t);
  write(
    root,
    ".agents/skills/example/SKILL.md",
    skill("", "example", "!`touch PWNED`\n<script>process.exit(0)</script>"),
  );
  assert.equal(run(cli, root).status, 0);
  assert.equal(fs.existsSync(path.join(root, "PWNED")), false);
});
