import {
  optional,
  string,
  boolean,
  choice,
  list,
  object,
  fields,
  isMapping,
  mapping,
  pattern,
  type Check,
  type Shape,
} from "./checks.js";
const platform = choice("darwin", "linux", "win32");
const installKinds = new Map([
  ["brew", "formula"],
  ["node", "package"],
  ["go", "module"],
  ["uv", "package"],
  ["download", "url"],
]);
const nonnegativeInteger: Check = (value, field, report) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    report(field, `${field} must be a nonnegative integer.`);
};
const installerFields: Shape = {
  id: optional(string()),
  label: optional(string()),
  bins: optional(list(string())),
  os: optional(list(platform)),
  sha256: optional(pattern(/^[a-f\d]{64}$/i, "64 hexadecimal characters")),
  archive: optional(choice("tar.gz", "tar.bz2", "zip")),
  extract: optional(boolean),
  stripComponents: optional(nonnegativeInteger),
  targetDir: optional(string()),
};
const installer: Check = (value, field, report) => {
  if (!isMapping(value)) {
    mapping(value, field, report);
    return;
  }
  const kind = value.get("kind");
  if (typeof kind !== "string" || !installKinds.has(kind)) {
    report(field, `${field}.kind must be brew, node, go, uv, or download.`);
    return;
  }
  const requiredField = installKinds.get(kind);
  if (requiredField)
    string()(value.get(requiredField), `${field}.${requiredField}`, report);
  fields(value, installerFields, field, report);
};
const metadata: Check = object({
  openclaw: optional(
    object({
      always: optional(boolean),
      emoji: optional(string()),
      homepage: optional(string()),
      primaryEnv: optional(string()),
      skillKey: optional(string()),
      os: optional(list(platform)),
      requires: optional(
        object({
          bins: optional(list(string())),
          anyBins: optional(list(string())),
          env: optional(list(string())),
          config: optional(list(string())),
        }),
      ),
      install: optional(list(installer)),
    }),
  ),
});
export const openclaw: Shape = {
  homepage: optional(string()),
  "user-invocable": optional(boolean),
  "disable-model-invocation": optional(boolean),
  "command-dispatch": optional(choice("tool")),
  "command-tool": optional(string()),
  "command-arg-mode": optional(choice("raw")),
  metadata: optional(metadata),
};
export const validateDispatch: Check = (value, field, report) => {
  if (
    isMapping(value) &&
    value.get("command-dispatch") === "tool" &&
    !value.has("command-tool")
  )
    report(field, "command-tool is required when command-dispatch is tool.");
};
