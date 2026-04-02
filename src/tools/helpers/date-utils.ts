export type SupportedPeriod =
  | "this_month"
  | "last_month"
  | "last_30_days"
  | "this_year"
  | "all";

export interface DateRange {
  start: string;
  end: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateUtc(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-");
}

function createUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function parseIsoDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (match === null) {
    throw new Error(`La fecha "${date}" no tiene el formato YYYY-MM-DD.`);
  }

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const parsed = createUtcDate(year, month - 1, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`The date "${date}" is not valid.`);
  }

  return parsed;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = createUtcDate(targetYear, normalizedMonth + 1, 0).getUTCDate();

  return createUtcDate(targetYear, normalizedMonth, Math.min(day, lastDayOfTargetMonth));
}

export function todayISO(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("-");
}

export function computeNextDate(
  date: string,
  frequency: string,
  intervalDays = 0,
): string {
  const baseDate = parseIsoDate(date);

  switch (frequency) {
    case "WEEKLY":
      return formatDateUtc(addDays(baseDate, 7));
    case "BIWEEKLY":
      return formatDateUtc(addDays(baseDate, 14));
    case "MONTHLY":
      return formatDateUtc(addMonthsClamped(baseDate, 1));
    case "INTERVAL_DAYS":
      return formatDateUtc(addDays(baseDate, intervalDays));
    default:
      throw new Error(`The frequency "${frequency}" is not valid.`);
  }
}

export function resolvePeriodRange(
  period: SupportedPeriod,
  referenceDate = todayISO(),
): DateRange | null {
  if (period === "all") {
    return null;
  }

  const reference = parseIsoDate(referenceDate);

  switch (period) {
    case "this_month":
      return {
        start: formatDateUtc(
          createUtcDate(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
        ),
        end: formatDateUtc(reference),
      };
    case "last_month": {
      const lastMonthDate = addMonthsClamped(reference, -1);
      const year = lastMonthDate.getUTCFullYear();
      const month = lastMonthDate.getUTCMonth();

      return {
        start: formatDateUtc(createUtcDate(year, month, 1)),
        end: formatDateUtc(createUtcDate(year, month + 1, 0)),
      };
    }
    case "last_30_days":
      return {
        start: formatDateUtc(addDays(reference, -29)),
        end: formatDateUtc(reference),
      };
    case "this_year":
      return {
        start: formatDateUtc(createUtcDate(reference.getUTCFullYear(), 0, 1)),
        end: formatDateUtc(reference),
      };
    default:
      throw new Error(`The period "${period}" is not valid.`);
  }
}
