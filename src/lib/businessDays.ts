import { addDays, format, isWeekend } from 'date-fns'

/** Easter Sunday of a Gregorian year (anonymous Gregorian algorithm). */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const FIXED_HOLIDAYS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25']

// Carnival Monday/Tuesday, Good Friday and Corpus Christi, as offsets from Easter Sunday.
const EASTER_OFFSETS = [-48, -47, -2, 60]

const movableCache = new Map<number, Set<string>>()

function movableHolidays(year: number): Set<string> {
  let days = movableCache.get(year)
  if (!days) {
    const easter = easterSunday(year)
    days = new Set(EASTER_OFFSETS.map((offset) => format(addDays(easter, offset), 'MM-dd')))
    movableCache.set(year, days)
  }
  return days
}

/** National days on which Brazilian banks do not open. City and state holidays are not covered. */
export function isBankHoliday(date: Date): boolean {
  const md = format(date, 'MM-dd')
  if (FIXED_HOLIDAYS.includes(md)) return true
  if (md === '11-20' && date.getFullYear() >= 2024) return true // Consciência Negra
  return movableHolidays(date.getFullYear()).has(md)
}

/** The date itself if it is a business day, otherwise the next one. */
export function nextBusinessDay(date: Date): Date {
  let d = date
  while (isWeekend(d) || isBankHoliday(d)) d = addDays(d, 1)
  return d
}
