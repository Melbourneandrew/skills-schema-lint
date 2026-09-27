import {
  optional,
  required,
  string,
  stringMap,
  text,
  type Shape,
} from "./checks.js";
export const standard: Shape = {
  name: required(string(64)),
  description: required(string(1024)),
  license: optional(text),
  compatibility: optional(string(500)),
  metadata: optional(stringMap),
  "allowed-tools": optional(text),
};
