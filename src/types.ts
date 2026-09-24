export type TxType = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  color: string
  icon: string
}

/** Links the transactions that make up one purchase paid in installments. */
export interface Installment {
  groupId: string
  index: number // 1-based
  total: number
}

export interface Transaction {
  id: string
  type: TxType
  description: string
  amount: number
  categoryId: string
  date: string // yyyy-MM-dd; for card purchases, the due date of the bill they fall into
  paid: boolean
  installment?: Installment
  createdAt?: number // ms; missing on entries saved before it existed
  onCard?: boolean
  purchaseDate?: string // yyyy-MM-dd, set on card purchases
}

export interface Recurring {
  id: string
  type: TxType
  description: string
  amount: number
  categoryId: string
  dayOfMonth: number // on the card: the day it is charged
  startMonth: string // yyyy-MM
  endMonth?: string // yyyy-MM (inclusive)
  active: boolean
  createdAt?: number // ms; missing on entries saved before it existed
  onCard?: boolean // each charge counts in the month its bill is due
}

export interface RecurringMonthStatus {
  paid: boolean
  amountOverride?: number
  skipped?: boolean
}

// recurringId -> month (yyyy-MM) -> status
export type RecurringStatusMap = Record<string, Record<string, RecurringMonthStatus>>

/** Credit card billing cycle, used to date installment purchases by the bill they fall into. */
export interface CardSettings {
  closingDay: number // purchases on or after this day go to the next bill
  dueDay: number
}

export interface FinanceState {
  version: 1
  categories: Category[]
  transactions: Transaction[]
  recurring: Recurring[]
  recurringStatus: RecurringStatusMap
  card?: CardSettings
}

/** A row shown for a month: either a one-off transaction or a virtual recurring instance. */
export interface MonthItem {
  key: string
  source: 'transaction' | 'recurring'
  sourceId: string
  type: TxType
  description: string
  amount: number
  categoryId: string
  date: string
  paid: boolean
  installment?: Installment
  onCard?: boolean
  purchaseDate?: string
}
