export type Report = (field: string, message: string) => void;
export type Check = (value: unknown, field: string, report: Report) => void;
export interface Field {
  check: Check;
  required?: boolean;
}
export type Shape = Record<string, Field>;
export const optional = (check: Check): Field => ({ check });
export const required = (check: Check): Field => ({ check, required: true });
export function isMapping(value: unknown): value is Map<string, unknown> {
  return (
    value instanceof Map &&
    [...value.keys()].every((key: unknown) => typeof key === "string")
  );
}
export const text: Check = (value, field, report) => {
  if (typeof value !== "string") report(field, `${field} must be a string.`);
};
export const string =
  (maximum = Infinity): Check =>
  (value, field, report) => {
    if (typeof value !== "string" || !value.trim())
      report(field, `${field} must be a nonempty string.`);
    else if ([...value].length > maximum)
      report(field, `${field} must be at most ${maximum} characters.`);
  };
export const boolean: Check = (value, field, report) => {
  if (typeof value !== "boolean")
    report(field, `${field} must be a YAML boolean (true or false).`);
};
export const choice =
  (...values: string[]): Check =>
  (value, field, report) => {
    if (typeof value !== "string" || !values.includes(value))
      report(field, `${field} must be one of: ${values.join(", ")}.`);
  };
export const list =
  (check: Check): Check =>
  (value, field, report) => {
    if (!Array.isArray(value)) {
      report(field, `${field} must be a list.`);
      return;
    }
    value.forEach((item: unknown, index) =>
      check(item, `${field}[${index}]`, report),
    );
  };
export const stringOrList: Check = (value, field, report) => {
  if (typeof value === "string") string()(value, field, report);
  else list(string())(value, field, report);
};
export const mapping: Check = (value, field, report) => {
  if (!isMapping(value))
    report(field, `${field} must be a mapping with string keys.`);
};
export const stringMap: Check = (value, field, report) => {
  if (!isMapping(value)) {
    mapping(value, field, report);
    return;
  }
  for (const [key, item] of value)
    if (typeof item !== "string")
      report(
        field,
        `${field}.${key} must be a string. Quote numbers and booleans.`,
      );
};
export const pattern =
  (regex: RegExp, description: string): Check =>
  (value, field, report) => {
    if (typeof value !== "string" || !regex.test(value))
      report(field, `${field} must be ${description}.`);
  };
export function fields(
  value: Map<string, unknown>,
  shape: Shape,
  prefix: string,
  report: Report,
) {
  for (const [key, field] of Object.entries(shape)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value.has(key)) field.check(value.get(key), name, report);
    else if (field.required) report(name, `${name} is required.`);
  }
}
export const object =
  (shape: Shape): Check =>
  (value, field, report) => {
    if (!isMapping(value)) {
      mapping(value, field, report);
      return;
    }
    fields(value, shape, field, report);
  };
