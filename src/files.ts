import fs from "node:fs";
import path from "node:path";
import { Limits } from "./types.js";

export function contains(workspace: string, target: string): boolean {
  const relative = path.relative(workspace, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
export function exists(file: string): boolean {
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
/** Read a regular UTF-8 file with bounded memory, without following paths outside the workspace. */
export function readBounded(file: string, workspace: string): string {
  const real = fs.realpathSync(file);
  if (!contains(workspace, real))
    throw new Error("Path resolves outside the workspace.");
  if (!fs.statSync(real).isFile()) throw new Error("Expected a regular file.");
  const fd = fs.openSync(real, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
  try {
    return readDescriptor(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function readDescriptor(fd: number): string {
  const stat = fs.fstatSync(fd);
  if (!stat.isFile()) throw new Error("Expected a regular file.");
  if (stat.size > Limits.FileBytes)
    throw new Error("File exceeds the 1 MiB limit.");
  const buffer = Buffer.alloc(stat.size + 1);
  let size = 0;
  while (size < buffer.length) {
    const count = fs.readSync(fd, buffer, size, buffer.length - size, null);
    if (!count) break;
    size += count;
  }
  if (size > stat.size)
    throw new Error(
      "File grew while being read; retry with a stable checkout.",
    );
  return new TextDecoder("utf-8", { fatal: true }).decode(
    buffer.subarray(0, size),
  );
}
