import { getDaysInMonth } from 'date-fns'
import type { FinanceState, Recurring, RecurringStatusMap, Transaction, TxType } from '../types'
import { currentMonth, parseMonth, shiftMonth, today } from '../lib/format'
import { DEFAULT_CATEGORIES } from './defaults'

// Fictional numbers for the public demo. They are not related to anyone's real finances.

const RECURRING: Omit<Recurring, 'id' | 'startMonth' | 'active'>[] = [
  { type: 'income', description: 'Salário', amount: 7000, categoryId: 'renda', dayOfMonth: 5 },
  { type: 'income', description: 'Freelance', amount: 1200, categoryId: 'renda', dayOfMonth: 20 },
  { type: 'expense', description: 'Aluguel', amount: 1900, categoryId: 'moradia', dayOfMonth: 10 },
  { type: 'expense', description: 'Condomínio', amount: 420, categoryId: 'moradia', dayOfMonth: 10 },
  { type: 'expense', description: 'Internet fibra', amount: 99.9, categoryId: 'moradia', dayOfMonth: 15 },
  { type: 'expense', description: 'Streaming de vídeo', amount: 44.9, categoryId: 'assinaturas', dayOfMonth: 8 },
  { type: 'expense', description: 'Streaming de música', amount: 21.9, categoryId: 'assinaturas', dayOfMonth: 12 },
  { type: 'expense', description: 'Armazenamento na nuvem', amount: 9.9, categoryId: 'assinaturas', dayOfMonth: 18 },
  { type: 'expense', description: 'Academia', amount: 119.9, categoryId: 'saude', dayOfMonth: 3 },
  { type: 'expense', description: 'Plano de saúde', amount: 380, categoryId: 'saude', dayOfMonth: 20 },
  { type: 'expense', description: 'Curso online', amount: 79.9, categoryId: 'educacao', dayOfMonth: 25 },
  { type: 'expense', description: 'DAS MEI', amount: 75.9, categoryId: 'impostos', dayOfMonth: 20 },
]

// [description, category, typical amount]
const DAILY: [string, string, number][] = [
  ['Padaria', 'alimentacao', 24],
  ['Restaurante', 'alimentacao', 68],
  ['Delivery', 'alimentacao', 52],
  ['Combustível', 'transporte', 180],
  ['Aplicativo de transporte', 'transporte', 27],
  ['Cinema', 'lazer', 56],
  ['Farmácia', 'saude', 43],
  ['Presente', 'outros', 90],
]

/** Deterministic pseudo-random so the demo looks the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

let counter = 0
const id = () => `demo-${++counter}`

export function createDemoState(): FinanceState {
  const now = currentMonth()
  const todayStr = today()
  const months = [shiftMonth(now, -2), shiftMonth(now, -1), now]
  const random = rng(42)

  const recurring: Recurring[] = RECURRING.map((r) => ({ ...r, id: id(), startMonth: months[0], active: true }))

  // Past months fully paid; current month paid up to today, with one overdue bill left open.
  const recurringStatus: RecurringStatusMap = {}
  for (const r of recurring) {
    recurringStatus[r.id] = {}
    for (const m of months) {
      const due = `${m}-${String(r.dayOfMonth).padStart(2, '0')}`
      const overdueOnPurpose = m === now && r.description === 'Plano de saúde'
      recurringStatus[r.id][m] = { paid: due <= todayStr && !overdueOnPurpose }
    }
  }

  const transactions: Transaction[] = []
  const push = (type: TxType, description: string, categoryId: string, date: string, amount: number, paid: boolean) =>
    transactions.push({ id: id(), type, description, categoryId, date, amount: Math.round(amount * 100) / 100, paid })

  for (const m of months) {
    const days = m === now ? Number(todayStr.slice(8, 10)) : getDaysInMonth(parseMonth(m))
    for (let day = 1; day <= days; day++) {
      if (random() > 0.45) continue
      const [description, categoryId, base] = DAILY[Math.floor(random() * DAILY.length)]
      const date = `${m}-${String(day).padStart(2, '0')}`
      push('expense', description, categoryId, date, base * (0.6 + random() * 0.8), true)
    }
    for (const day of [6, 13, 20, 27]) {
      if (day > days) break
      push('expense', 'Supermercado', 'alimentacao', `${m}-${String(day).padStart(2, '0')}`, 220 + random() * 160, true)
    }
  }

  // A tax installment still to pay at the end of the current month.
  const lastDay = String(getDaysInMonth(parseMonth(now))).padStart(2, '0')
  push('expense', 'IPVA — parcela', 'impostos', `${now}-${lastDay}`, 412.37, false)

  return { version: 1, categories: DEFAULT_CATEGORIES, transactions, recurring, recurringStatus }
}
