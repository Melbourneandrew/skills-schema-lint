import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../dist/index.cjs";
import { workspace, write, skill, check } from "./helpers.mjs";
for (const profile of [
  "spec",
  "claude",
  "codex",
  "gemini",
  "opencode",
  "openclaw",
  "cursor",
]) {
  test(`portable frontmatter works with ${profile}`, (t) => {
    const result = check(
      t,
      skill(
        'license: MIT\ncompatibility: Requires Node.js\nallowed-tools: Read Bash(git:*)\nmetadata:\n  author: Andrew\n  version: "1.0"\n',
      ),
      { profile },
    );
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.skillCount, 1);
  });
}
const invalidCases = [
  ["missing name", "---\ndescription: Example\n---\nBody", "field"],
  ["missing description", "---\nname: example\n---\nBody", "field"],
  ["empty name", skill("", '""'), "field"],
  ["uppercase name", skill("", "Example"), "name"],
  ["leading hyphen", skill("", "-example"), "name"],
  ["double hyphen", skill("", "ex--ample"), "name"],
  ["trailing hyphen", skill("", "example-"), "name"],
  ["name mismatch", skill("", "other"), "name"],
  [
    "non-string description",
    "---\nname: example\ndescription: true\n---\nBody",
    "field",
  ],
  [
    "description too long",
    `---\nname: example\ndescription: ${"x".repeat(1025)}\n---\nBody`,
    "field",
  ],
  [
    "blank description",
    '---\nname: example\ndescription: "   "\n---\nBody',
    "field",
  ],
  ["bad compatibility", skill("compatibility: [linux]\n"), "field"],
  ["long compatibility", skill(`compatibility: ${"x".repeat(501)}\n`), "field"],
  ["empty compatibility", skill('compatibility: ""\n'), "field"],
  ["typed metadata", skill("metadata:\n  version: 1\n"), "field"],
  ["list metadata", skill("metadata: []\n"), "field"],
  ["non-string metadata keys", skill("metadata: {42: string}\n"), "field"],
  ["tool list in spec", skill("allowed-tools: [Read]\n"), "field"],
  ["unknown spec field", skill("modle: sonnet\n"), "unknown-field"],
  ["duplicate YAML key", skill("name: example\n"), "yaml"],
  ["duplicate nested key", skill("metadata: {a: x, a: y}\n"), "yaml"],
  ["custom tag", skill("metadata: !custom hello\n"), "yaml"],
  ["non-string root key", skill("42: value\n"), "yaml"],
  ["missing opening delimiter", "name: example\n", "yaml"],
  ["missing closing delimiter", "---\nname: example\n", "yaml"],
  ["not a mapping", "---\n[foo, bar]\n---\nBody", "yaml"],
  ["invalid YAML", "---\nname: [\n---\nBody", "yaml"],
  ["invalid document marker", "---hello\nname: example\n---\nBody", "yaml"],
];
for (const [label, content, rule] of invalidCases)
  test(label, (t) => {
    const result = check(t, content, { profile: "spec" });
    assert.equal(result.ok, false);
    assert.ok(
      result.diagnostics.some((d) => d.rule === rule),
      JSON.stringify(result),
    );
  });
for (const [label, description] of [
  ["folded", ">\n  First line\n  second line"],
  ["literal", "|-\n  First line\n  second line"],
  ["plain multiline", "\n  First line\n  second line"],
  ["quoted colon", '"A: B # C"'],
  ["flow metadata", "Something useful"],
  ["delimiter inside value", '"Contains --- in text"'],
])
  test(`YAML ${label}`, (t) => {
    const result = check(
      t,
      `---\nname: example\ndescription: ${description}\nmetadata: {author: "A", version: '1'}\n---\nBody`,
    );
    assert.equal(result.ok, true, JSON.stringify(result));
  });
test("UTF-8 BOM and CRLF", (t) =>
  assert.equal(check(t, "\uFEFF" + skill().replaceAll("\n", "\r\n")).ok, true));
test("YAML aliases remain typed", (t) =>
  assert.equal(
    check(t, skill("license: &license MIT\nmetadata:\n  license: *license\n"))
      .ok,
    true,
  ));
test("YAML unknown alias rejected", (t) =>
  assert.equal(check(t, skill("license: *missing\n")).ok, false));
test("YAML alias amplification rejected", (t) => {
  const root = workspace(t);
  const content = skill(
    "metadata:\n  a: &a [x, x, x, x, x, x, x, x, x, x]\n  b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]\n  c: [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]\n",
  );
  write(root, ".claude/skills/example/SKILL.md", content);
  assert.equal(validate({ workspace: root }).ok, false);
});
test("prototype-looking keys cannot change validation behavior", (t) => {
  assert.equal(
    check(t, skill("__proto__: {polluted: yes}\nconstructor: foo\n")).ok,
    false,
  );
  assert.equal({}.polluted, undefined);
});
test("code point length, not UTF-16 units", (t) => {
  const content = `---\nname: example\ndescription: "${"🙂".repeat(1024)}"\n---\nBody`;
  assert.equal(check(t, content).ok, true);
});
test("Unicode standard names; ASCII-only OpenCode names", (t) => {
  const root = workspace(t);
  write(root, "skills/café/SKILL.md", skill("", "café"));
  assert.equal(validate({ workspace: root, profile: "spec" }).ok, true);
  assert.equal(validate({ workspace: root, profile: "opencode" }).ok, false);
});
test("NFKC-normalized directory match", (t) => {
  const root = workspace(t);
  write(root, "skills/ｔｅｓｔ/SKILL.md", skill("", "test"));
  assert.equal(validate({ workspace: root, profile: "spec" }).ok, true);
});
test("name length limit", (t) => {
  const root = workspace(t);
  for (const size of [64, 65])
    write(
      root,
      `skills/${"a".repeat(size)}/SKILL.md`,
      skill("", "a".repeat(size)),
    );
  const result = validate({ workspace: root });
  assert.equal(result.errorCount, 1);
});
test("empty body and large body are advisories", (t) => {
  assert.equal(check(t, skill("", "example", "")).warningCount, 1);
  assert.equal(
    check(t, skill("", "example", ""), { failOnWarnings: true }).ok,
    false,
  );
  assert.equal(
    check(t, skill("", "example", "line\n".repeat(501))).warningCount,
    1,
  );
});

test("optional license and tools permit empty strings, not non-string scalars", (t) => {
  assert.equal(check(t, skill('license: ""\nallowed-tools: ""\n')).ok, true);
  assert.equal(check(t, skill("license: false\n")).ok, false);
});
test("length is also checked after NFKC expansion", (t) => {
  const root = workspace(t);
  const name = "ﬃ".repeat(22);
  write(root, `skills/${name}/SKILL.md`, skill("", name));
  assert.equal(validate({ workspace: root }).ok, false);
});
