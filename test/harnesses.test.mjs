import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../dist/index.cjs";
import { workspace, write, skill, check } from "./helpers.mjs";
test("Claude extensions", (t) => {
  const result = check(
    t,
    skill(
      'context: fork\nagent: Explore\neffort: high\nallowed-tools: [Read, Grep]\narguments: [issue, branch]\nbackground: false\npaths: ["src/**"]\ndisable-model-invocation: true\nhooks: {}\nmetadata: {nested: {value: true}}\n',
    ),
    { profile: "claude" },
  );
  assert.equal(result.ok, true, JSON.stringify(result));
});
for (const fields of [
  "context: inline\n",
  "effort: extreme\n",
  'user-invocable: "false"\n',
  "hooks: []\n",
  "arguments: [42]\n",
  "shell: zsh\n",
])
  test(`Claude rejects ${fields.trim()}`, (t) =>
    assert.equal(check(t, skill(fields), { profile: "claude" }).ok, false));
test("unknown native fields warn instead of breaking extensions", (t) => {
  const result = check(t, skill("future-field: true\n"), { profile: "claude" });
  assert.equal(result.ok, true);
  assert.equal(result.warningCount, 1);
});
test("OpenClaw extensions and nested gating metadata", (t) => {
  const result = check(
    t,
    skill(
      "homepage: https://example.com\ncommand-dispatch: tool\ncommand-tool: exec\ncommand-arg-mode: raw\nmetadata:\n  openclaw:\n    always: false\n    os: [linux, darwin]\n    primaryEnv: API_KEY\n    requires:\n      bins: [node]\n      anyBins: [npm, pnpm]\n      env: [API_KEY]\n      config: [browser.enabled]\n    install:\n      - kind: node\n        package: example\n",
    ),
    { profile: "openclaw" },
  );
  assert.equal(result.ok, true, JSON.stringify(result));
});
for (const fields of [
  "command-dispatch: shell\n",
  "command-dispatch: tool\n",
  "metadata: {openclaw: []}\n",
  "metadata: {openclaw: {os: [macos]}}\n",
  "metadata: {openclaw: {requires: {bins: node}}}\n",
  "metadata: {openclaw: {install: [{kind: brew}]}}\n",
])
  test(`OpenClaw rejects ${fields.trim()}`, (t) =>
    assert.equal(check(t, skill(fields), { profile: "openclaw" }).ok, false));
test("Cursor boolean extension", (t) => {
  assert.equal(
    check(t, skill("disable-model-invocation: false\n"), { profile: "cursor" })
      .ok,
    true,
  );
  assert.equal(
    check(t, skill("disable-model-invocation: 1\n"), { profile: "cursor" }).ok,
    false,
  );
});
test("Codex sidecar recognized in shared standard root", (t) => {
  const root = workspace(t);
  write(root, ".agents/skills/example/SKILL.md", skill());
  write(
    root,
    ".agents/skills/example/agents/openai.yaml",
    'interface:\n  display_name: Example\n  brand_color: "#123abc"\npolicy:\n  allow_implicit_invocation: false\ndependencies:\n  tools:\n    - type: mcp\n      value: example\n      transport: streamable_http\n      url: https://example.com/mcp\n',
  );
  assert.equal(validate({ workspace: root }).ok, true);
  write(
    root,
    ".agents/skills/example/agents/openai.yaml",
    'policy:\n  allow_implicit_invocation: "false"\n',
  );
  const result = validate({ workspace: root });
  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].file, /openai.yaml$/);
});
for (const sidecar of [
  "[]",
  "interface: []",
  "interface: {brand_color: red}",
  "dependencies: {tools: {}}",
  "dependencies: {tools: [{type: mcp}]}",
  "policy: {allow_implicit_invocation: 1}",
  "interface:\n display_name: [x]",
])
  test(`invalid Codex sidecar: ${sidecar}`, (t) => {
    const root = workspace(t);
    write(root, "skills/example/SKILL.md", skill());
    write(root, "skills/example/agents/openai.yaml", sidecar);
    assert.equal(validate({ workspace: root }).ok, false);
  });

test("OpenCode rejects fullwidth names and requires raw directory equality", (t) => {
  const root = workspace(t);
  write(root, "skills/ｔｅｓｔ/SKILL.md", skill("", "ｔｅｓｔ"));
  assert.equal(validate({ workspace: root, profile: "opencode" }).ok, false);
  write(root, "skills/ｔｅｓｔ/SKILL.md", skill("", "test"));
  assert.equal(validate({ workspace: root, profile: "opencode" }).ok, false);
  assert.equal(validate({ workspace: root, profile: "spec" }).ok, true);
});
