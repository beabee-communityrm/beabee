import { strict as assert } from "assert";

export function s(name: string, def?: string): string {
  const value = process.env[name] || def;
  assert(value !== undefined);
  return value;
}

export function ss(name: string, def?: string[]): string[] {
  const value = process.env[name]?.split(",") || def;
  assert(value !== undefined);
  return value;
}

export function n(name: string, def?: number): number {
  const value = Number(process.env[name]) || def;
  assert(value !== undefined && !isNaN(value));
  return value;
}

export function b(name: string, def?: boolean): boolean {
  const value = process.env[name];
  if (value === undefined && def !== undefined) {
    return def;
  }
  assert(value === "true" || value === "false");
  return value === "true";
}

const a = ["a", "b"] as const;
type A = typeof a[number];

export function e<T extends readonly string[]>(
  name: string,
  options: T,
  def?: typeof options[number]
): typeof options[number] {
  const value = s(name, def);
  assert(options.indexOf(value) !== -1);
  return value;
}
