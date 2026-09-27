import {
  optional,
  boolean,
  string,
  stringOrList,
  choice,
  type Shape,
} from "./checks.js";
export const cursor: Shape = {
  "disable-model-invocation": optional(boolean),
  paths: optional(stringOrList),
  icon: optional(string()),
  color: optional(
    choice(
      "default",
      "green",
      "cyan",
      "blue",
      "purple",
      "magenta",
      "orange",
      "yellow",
      "red",
      "brand",
    ),
  ),
};
