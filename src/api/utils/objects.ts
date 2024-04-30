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
