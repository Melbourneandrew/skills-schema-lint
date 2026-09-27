import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validate } from "../dist/index.cjs";
const root = fs.mkdtempSync(
  path.join(os.tmpdir(), "skills-schema-lint-bench-"),
);
const sizes = [10, 100, 1000];
const median = (samples) =>
  [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
try {
  const results = [];
  for (const count of sizes) {
    const collection = path.join(root, `corpus-${count}`);
    for (let index = 0; index < count; index++) {
      const name = `example-${index}`;
      const directory = path.join(collection, name);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "SKILL.md"),
        `---\nname: ${name}\ndescription: Validate example ${index} when testing skills.\nmetadata:\n  version: "1.0"\n---\n\nFollow the instructions.\n`,
      );
    }
    const samples = [];
    for (let iteration = 0; iteration < 6; iteration++) {
      const result = validate({ workspace: root, paths: [collection] });
      if (!result.ok || result.skillCount !== count)
        throw new Error(JSON.stringify(result));
      if (iteration > 0) samples.push(result.durationMs);
    }
    const cold = [];
    for (let iteration = 0; iteration < 5; iteration++) {
      const start = performance.now();
      const child = spawnSync(
        process.execPath,
        [
          path.resolve("dist/cli.cjs"),
          "--workspace",
          root,
          collection,
          "--format",
          "json",
        ],
        { encoding: "utf8", timeout: 30_000 },
      );
      if (child.status !== 0 || JSON.parse(child.stdout).skillCount !== count)
        throw new Error(child.stderr || child.stdout);
      cold.push(Math.round((performance.now() - start) * 100) / 100);
    }
    results.push({
      skills: count,
      warmMedianMs: median(samples),
      coldProcessMedianMs: median(cold),
    });
  }
  console.log(
    JSON.stringify(
      {
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        cpu: os.cpus()[0]?.model,
        actionBytes: fs.statSync("dist/action.cjs").size,
        results,
        method:
          "Generated fixtures; filesystem cache warm; five measured runs after one warmup. Cold process includes Node startup. Excludes checkout, action download, runner provisioning.",
      },
      null,
      2,
    ),
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
