import { getDaysInMonth, parse } from 'date-fns'
import type { Category, FinanceState, MonthItem, Recurring, Transaction } from '../types'
import { parseMonth, shiftMonth, today } from './format'
import { cardDueDate } from './installments'

export const isRecurringInMonth = (r: Recurring, month: string) =>
  r.active && r.startMonth <= month && (!r.endMonth || month <= r.endMonth)

const transactionItem = (t: Transaction): MonthItem => ({
  key: `t-${t.id}`,
  source: 'transaction',
  sourceId: t.id,
  type: t.type,
  description: t.description,
  amount: t.amount,
  categoryId: t.categoryId,
  date: t.date,
  paid: t.paid,
  installment: t.installment,
  onCard: t.onCard,
  purchaseDate: t.purchaseDate,
})

const chargeDate = (r: Recurring, month: string) =>
  `${month}-${String(Math.min(r.dayOfMonth, getDaysInMonth(parseMonth(month)))).padStart(2, '0')}`

export function getMonthItems(state: FinanceState, month: string): MonthItem[] {
  const items = state.transactions.filter((t) => t.date.startsWith(month)).map(transactionItem)

  for (const r of state.recurring) {
    const onCard = !!(r.onCard && state.card)
    let date: string | undefined
    let purchaseDate: string | undefined
    if (onCard) {
      // a charge lands in the bill due up to two months later, depending on the card's closing and due days
      for (const chargeMonth of [shiftMonth(month, -2), shiftMonth(month, -1), month]) {
        if (!isRecurringInMonth(r, chargeMonth)) continue
        const charged = chargeDate(r, chargeMonth)
        const due = cardDueDate(charged, state.card!)
        if (due.startsWith(month)) {
          date = due
          purchaseDate = charged
        }
      }
    } else if (isRecurringInMonth(r, month)) {
      date = chargeDate(r, month)
    }
    if (!date) continue
    const status = state.recurringStatus[r.id]?.[month]
    if (status?.skipped) continue
    items.push({
      key: `r-${r.id}-${month}`,
      source: 'recurring',
      sourceId: r.id,
      type: r.type,
      description: r.description,
      amount: status?.amountOverride ?? r.amount,
      categoryId: r.categoryId,
      date,
      paid: status?.paid ?? false,
      ...(onCard && { onCard, purchaseDate }),
    })
  }

  return items.sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description))
}

/**
 * Most recently added entries across all months, one row per installment purchase (its 1st installment).
 * Entries saved before `createdAt` existed fall back to their date, and only once that date has passed.
 */
export function getRecentItems(state: FinanceState, limit: number): MonthItem[] {
  const now = today()
  const firstIndex = new Map<string, number>()
  for (const { installment: inst } of state.transactions)
    if (inst) firstIndex.set(inst.groupId, Math.min(inst.index, firstIndex.get(inst.groupId) ?? inst.index))

  const rows: { item: MonthItem; sortKey: number }[] = []
  for (const t of state.transactions) {
    if (t.createdAt !== undefined) {
      if (t.installment && t.installment.index !== firstIndex.get(t.installment.groupId)) continue
      rows.push({ item: transactionItem(t), sortKey: t.createdAt })
    } else if (t.date <= now) {
      rows.push({ item: transactionItem(t), sortKey: parse(t.date, 'yyyy-MM-dd', new Date()).getTime() })
    }
  }
  for (const r of state.recurring) {
    if (r.createdAt === undefined) continue
    // first occurrence: the start month, or up to two months later when the charge goes to a later card bill
    const item = [0, 1, 2]
      .map((delta) => shiftMonth(r.startMonth, delta))
      .map((m) => getMonthItems(state, m).find((i) => i.key === `r-${r.id}-${m}`))
      .find(Boolean)
    if (item) rows.push({ item, sortKey: r.createdAt })
  }
  return rows
    .sort((a, b) => b.sortKey - a.sortKey || b.item.date.localeCompare(a.item.date))
    .slice(0, limit)
    .map((r) => r.item)
}

/** Expenses of the month that are on the credit card bill. */
export function getCardBill(items: MonthItem[]) {
  const billItems = items.filter((i) => i.onCard && i.type === 'expense')
  const pendingItems = billItems.filter((i) => !i.paid)
  return {
    items: billItems,
    pendingItems,
    total: billItems.reduce((sum, i) => sum + i.amount, 0),
    pending: pendingItems.reduce((sum, i) => sum + i.amount, 0),
  }
}

export function getTotals(items: MonthItem[]) {
  let income = 0
  let expense = 0
  let pending = 0
  let pendingCount = 0
  for (const i of items) {
    if (i.type === 'income') income += i.amount
    else {
      expense += i.amount
      if (!i.paid) {
        pending += i.amount
        pendingCount++
      }
    }
  }
  return { income, expense, balance: income - expense, pending, pendingCount }
}

export interface CategoryTotal {
  category: Category
  total: number
  share: number
}

export function getExpensesByCategory(items: MonthItem[], categories: Category[]): CategoryTotal[] {
  const totals = new Map<string, number>()
  let sum = 0
  for (const i of items) {
    if (i.type !== 'expense') continue
    totals.set(i.categoryId, (totals.get(i.categoryId) ?? 0) + i.amount)
    sum += i.amount
  }
  return [...totals.entries()]
    .map(([id, total]) => ({
      category: categories.find((c) => c.id === id) ?? FALLBACK_CATEGORY,
      total,
      share: sum ? total / sum : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export function getDailyExpenses(items: MonthItem[], month: string) {
  const days = getDaysInMonth(parseMonth(month))
  const data = Array.from({ length: days }, (_, i) => ({ day: i + 1, total: 0 }))
  for (const i of items) {
    if (i.type !== 'expense') continue
    data[Number(i.date.slice(8, 10)) - 1].total += i.amount
  }
  return data
}

/** Unpaid expenses of the month, soonest first; flags the overdue ones. */
export function getUpcomingBills(items: MonthItem[]) {
  const now = today()
  return items
    .filter((i) => i.type === 'expense' && !i.paid)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((i) => ({ ...i, overdue: i.date < now }))
}

export const FALLBACK_CATEGORY: Category = { id: '__none', name: 'Sem categoria', color: '#94a3b8', icon: '❔' }

export const findCategory = (categories: Category[], id: string) =>
  categories.find((c) => c.id === id) ?? FALLBACK_CATEGORY

export interface InstallmentPlan {
  groupId: string
  description: string
  categoryId: string
  count: number
  paidCount: number
  total: number
  remaining: number
  firstDate: string
  lastDate: string
  transactions: Transaction[]
}

/** Groups installment transactions by purchase; plans with pending installments come first. */
export function getInstallmentPlans(state: FinanceState): InstallmentPlan[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of state.transactions) {
    if (!t.installment) continue
    const list = groups.get(t.installment.groupId) ?? []
    list.push(t)
    groups.set(t.installment.groupId, list)
  }
  return [...groups.entries()]
    .map(([groupId, list]) => {
      const sorted = list.sort((a, b) => a.installment!.index - b.installment!.index)
      const last = sorted[sorted.length - 1]
      return {
        groupId,
        description: sorted[0].description,
        categoryId: sorted[0].categoryId,
        count: sorted.length,
        paidCount: sorted.filter((t) => t.paid).length,
        total: sorted.reduce((sum, t) => sum + t.amount, 0),
        remaining: sorted.filter((t) => !t.paid).reduce((sum, t) => sum + t.amount, 0),
        firstDate: sorted[0].date,
        lastDate: last.date,
        transactions: sorted,
      }
    })
    .sort((a, b) => Number(a.remaining === 0) - Number(b.remaining === 0) || a.lastDate.localeCompare(b.lastDate))
}
