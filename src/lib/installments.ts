import { addMonths, format, getDaysInMonth, parse, setDate } from 'date-fns'
import type { CardSettings, Transaction, TxType } from '../types'
import { nextBusinessDay } from './businessDays'
import { today, uid } from './format'

export type InstallmentValueMode = 'total' | 'parcela'

export const MAX_INSTALLMENTS = 72

interface BuildOptions {
  base: { type: TxType; description: string; categoryId: string; onCard?: boolean; purchaseDate?: string }
  valueMode: InstallmentValueMode
  value: number
  dates: string[] // yyyy-MM-dd, one per installment
  markPastAsPaid: boolean
}

/** Splits an amount into `count` parts in cents; the last part absorbs the rounding remainder. */
export function splitAmount(value: number, valueMode: InstallmentValueMode, count: number): number[] {
  if (valueMode === 'parcela') return Array.from({ length: count }, () => value)
  const totalCents = Math.round(value * 100)
  const partCents = Math.floor(totalCents / count)
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? (totalCents - partCents * (count - 1)) / 100 : partCents / 100,
  )
}

/** Same day on each following month; day 31 falls back to the last day of shorter months. */
export function installmentDates(firstDate: string, count: number): string[] {
  const first = parse(firstDate, 'yyyy-MM-dd', new Date())
  return Array.from({ length: count }, (_, i) => format(addMonths(first, i), 'yyyy-MM-dd'))
}

const dayInMonth = (month: Date, day: number) => setDate(month, Math.min(day, getDaysInMonth(month)))

/**
 * Due dates of the card bills that each installment of a purchase made on `purchaseDate` falls into.
 * A due date on a weekend or bank holiday moves to the next business day.
 */
export function cardInstallmentDates(purchaseDate: string, count: number, { closingDay, dueDay }: CardSettings): string[] {
  const purchase = parse(purchaseDate, 'yyyy-MM-dd', new Date())
  const afterClosing = purchase.getDate() >= Math.min(closingDay, getDaysInMonth(purchase))
  const closingMonth = addMonths(setDate(purchase, 1), afterClosing ? 1 : 0)
  const firstDueMonth = addMonths(closingMonth, dueDay > closingDay ? 0 : 1)
  return Array.from({ length: count }, (_, i) => format(nextBusinessDay(dayInMonth(addMonths(firstDueMonth, i), dueDay)), 'yyyy-MM-dd'))
}

export const cardDueDate = (purchaseDate: string, card: CardSettings) => cardInstallmentDates(purchaseDate, 1, card)[0]

/** Due date of the card bill that is due in `month` (yyyy-MM). */
export const billDueDate = (month: string, card: CardSettings) =>
  format(nextBusinessDay(dayInMonth(parse(month, 'yyyy-MM', new Date()), card.dueDay)), 'yyyy-MM-dd')

export function buildInstallments({ base, valueMode, value, dates, markPastAsPaid }: BuildOptions): Transaction[] {
  const groupId = uid()
  const amounts = splitAmount(value, valueMode, dates.length)
  const now = today()
  const createdAt = Date.now()
  return dates.map((date, i) => ({
    id: uid(),
    ...base,
    amount: amounts[i],
    date,
    paid: markPastAsPaid && date <= now,
    installment: { groupId, index: i + 1, total: dates.length },
    createdAt,
  }))
}
