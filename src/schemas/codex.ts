import {
  optional,
  required,
  string,
  boolean,
  list,
  object,
  pattern,
  type Shape,
} from "./checks.js";
export const codexSidecar: Shape = {
  interface: optional(
    object({
      display_name: optional(string()),
      short_description: optional(string()),
      icon_small: optional(string()),
      icon_large: optional(string()),
      brand_color: optional(pattern(/^#[a-f\d]{6}$/i, "a six-digit hex color")),
      default_prompt: optional(string()),
    }),
  ),
  policy: optional(object({ allow_implicit_invocation: optional(boolean) })),
  dependencies: optional(
    object({
      tools: optional(
        list(
          object({
            type: required(string()),
            value: required(string()),
            description: optional(string()),
            transport: optional(string()),
            url: optional(string()),
          }),
        ),
      ),
    }),
  ),
};
