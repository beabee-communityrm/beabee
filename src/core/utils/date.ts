import { parseISO, add } from "date-fns";

export function createDateTime(date: string, time: string): Date;
export function createDateTime(
  date: string | undefined,
  time: string | undefined
): Date | null;
export function createDateTime(
  date: string | undefined,
  time: string | undefined
): Date | null {
  return date && time ? new Date(date + "T" + time) : null;
}

// Must be ordered from highest resolution to lowest (seconds to years)
const dateUnits = ["s", "m", "h", "d", "M", "y"] as const;
type DateUnit = typeof dateUnits[number];

const dateUnitMap: Record<DateUnit, keyof Duration> = {
  y: "years",
  M: "months",
  d: "days",
  h: "hours",
  m: "minutes",
  s: "seconds"
};

const relativeDate = /\$now(?<units>\(((y|M|d|h|m|s):(-?\d+),?)+\))?/;
const relativeUnit = /(y|M|d|h|m|s):(-?\d+)/g;
type UnitMatches = IterableIterator<[string, DateUnit, string]>;

// Matches the different parts of an ISO 8601 date. Note we don't validate the
// pattern properly as that is handled by parseISO, we just want to know which
// parts of the date were specified
const absoluteDate =
  /^(?<y>\d{4,})(-(?<M>\d\d)(-(?<d>\d\d)([T ](?<h>\d\d)(:(?<m>\d\d)(:(?<s>\d\d))?)?)?)?)?/;

// Convert relative dates and returns the minimum date unit specified
export function parseDate(value: string, now?: Date): [Date, DateUnit] {
  let date: Date;
  let units: DateUnit[];

  const relativeMatch = relativeDate.exec(value);
  if (relativeMatch) {
    date = now || new Date();
    const unitsGroup = relativeMatch.groups?.units;
    if (unitsGroup) {
      const unitMatches = unitsGroup.matchAll(relativeUnit) as UnitMatches;
      units = [];
      for (const [_, unit, delta] of unitMatches) {
        date = add(date, { [dateUnitMap[unit]]: Number(delta) });
        units.push(unit);
      }
    } else {
      units = ["d"];
    }
  } else {
    date = parseISO(value);
    units = Object.entries(absoluteDate.exec(value)?.groups || {})
      .filter(([_, n]) => !!n)
      .map(([unit]) => unit) as DateUnit[];
  }

  return [date, getMinDateUnit(units) || "s"];
}

export function getMinDateUnit(units: DateUnit[]): DateUnit | undefined {
  return dateUnits.find((unit) => units.includes(unit));
}
