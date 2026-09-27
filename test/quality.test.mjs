import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ESLint } from "eslint";

test("complexity and line-limit rules actually reject violations", async () => {
  const eslint = new ESLint();
  const branch = Array.from(
    { length: 11 },
    (_, index) => `if (value === ${index}) return ${index};`,
  ).join("\n");
  const source = `export function complex(value: number): number { ${branch}\n return -1; }`;
  const [complexity] = await eslint.lintText(source, {
    filePath: "src/report.ts",
  });
  assert.ok(
    complexity.messages.some((message) => message.ruleId === "complexity"),
  );
  const [lines] = await eslint.lintText("// line\n".repeat(501), {
    filePath: "scripts/probe.mjs",
  });
  assert.ok(lines.messages.some((message) => message.ruleId === "max-lines"));
});
test("strict compiler settings and zero external runtime package requirements", () => {
  const config = JSON.parse(
    fs.readFileSync("tsconfig.json", "utf8"),
  ).compilerOptions;
  for (const key of [
    "strict",
    "noUncheckedIndexedAccess",
    "exactOptionalPropertyTypes",
    "noImplicitReturns",
    "noFallthroughCasesInSwitch",
    "noImplicitOverride",
    "noUnusedLocals",
    "noUnusedParameters",
  ])
    assert.equal(config[key], true, key);
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
  assert.match(
    fs.readFileSync("action.yml", "utf8"),
    /main: dist\/action\.cjs/,
  );
});
