import { build } from "esbuild";
import { isBuiltin } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("dist", { recursive: true });
const base = {
  bundle: true,
  platform: "node",
  target: "node24",
  legalComments: "none",
  minify: true,
  sourcemap: false,
  metafile: true,
};
for (const [entry, format, outfile] of [
  ["src/action.ts", "cjs", "dist/action.cjs"],
  ["src/cli.ts", "cjs", "dist/cli.cjs"],
  ["src/validate.ts", "cjs", "dist/index.cjs"],
]) {
  const result = await build({
    ...base,
    entryPoints: [entry],
    format,
    outfile,
  });
  const external = Object.values(result.metafile.outputs)
    .flatMap((output) => output.imports)
    .filter((item) => item.external && !isBuiltin(item.path));
  if (external.length)
    throw new Error(`Unbundled runtime imports: ${JSON.stringify(external)}`);
}
const yaml = JSON.parse(readFileSync("node_modules/yaml/package.json", "utf8"));
writeFileSync(
  "dist/THIRD-PARTY-NOTICES.txt",
  `Bundled dependency: yaml ${yaml.version}\nLicense: ${yaml.license}\nSource: https://github.com/eemeli/yaml\n\n${readFileSync("node_modules/yaml/LICENSE", "utf8")}`,
);
