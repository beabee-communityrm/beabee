export function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string
): { [key: string]: T[] | undefined } {
  const result: { [key: string]: T[] } = {};
  for (const item of items) {
    const value = keyFn(item);
    if (!result[value]) result[value] = [];
    result[value].push(item);
  }
  return result;
}

export function prefixKeys(
  prefix: string,
  obj: Record<string, unknown>
): Record<string, unknown> {
  const newObj: any = {};
  for (const key in obj) {
    newObj[`${prefix}${key}`] = obj[key];
  }
  return newObj;
}
