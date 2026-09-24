import type { FinanceState } from '../types'
import type { Action } from './FinanceStore'
import { OTHER_CATEGORY_ID, createInitialState } from './defaults'

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

/** In-memory counterpart of the Firestore writes in FinanceStore, used by the demo mode. */
export function reducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case 'transaction/save':
      return { ...state, transactions: upsert(state.transactions, action.transaction) }
    case 'transaction/delete':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) }
    case 'transaction/togglePaid':
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === action.id ? { ...t, paid: !t.paid } : t)),
      }
    case 'recurring/save':
      return { ...state, recurring: upsert(state.recurring, action.recurring) }
    case 'recurring/delete': {
      const { [action.id]: _removed, ...recurringStatus } = state.recurringStatus
      return { ...state, recurring: state.recurring.filter((r) => r.id !== action.id), recurringStatus }
    }
    case 'recurring/setStatus': {
      const byMonth = state.recurringStatus[action.id] ?? {}
      const current = byMonth[action.month] ?? { paid: false }
      return {
        ...state,
        recurringStatus: {
          ...state.recurringStatus,
          [action.id]: { ...byMonth, [action.month]: { ...current, ...action.patch } },
        },
      }
    }
    case 'category/save':
      return { ...state, categories: upsert(state.categories, action.category) }
    case 'category/delete': {
      if (action.id === OTHER_CATEGORY_ID) return state
      const reassign = <T extends { categoryId: string }>(x: T) =>
        x.categoryId === action.id ? { ...x, categoryId: OTHER_CATEGORY_ID } : x
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        transactions: state.transactions.map(reassign),
        recurring: state.recurring.map(reassign),
      }
    }
    case 'state/replace':
      return action.state
    case 'state/reset':
      return createInitialState()
  }
}
