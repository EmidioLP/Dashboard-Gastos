import type { Category, FinanceState } from '../types'

export const OTHER_CATEGORY_ID = 'outros'
export const INCOME_CATEGORY_ID = 'renda'

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'moradia', name: 'Moradia', color: '#6366f1', icon: '🏠' },
  { id: 'alimentacao', name: 'Alimentação', color: '#f59e0b', icon: '🍽️' },
  { id: 'transporte', name: 'Transporte', color: '#0ea5e9', icon: '🚗' },
  { id: 'assinaturas', name: 'Assinaturas', color: '#a855f7', icon: '📺' },
  { id: 'impostos', name: 'Impostos', color: '#ef4444', icon: '🧾' },
  { id: 'saude', name: 'Saúde', color: '#10b981', icon: '💊' },
  { id: 'lazer', name: 'Lazer', color: '#ec4899', icon: '🎉' },
  { id: 'educacao', name: 'Educação', color: '#14b8a6', icon: '📚' },
  { id: INCOME_CATEGORY_ID, name: 'Renda', color: '#22c55e', icon: '💵' },
  { id: OTHER_CATEGORY_ID, name: 'Outros', color: '#64748b', icon: '📦' },
]

export const createInitialState = (): FinanceState => ({
  version: 1,
  categories: DEFAULT_CATEGORIES,
  transactions: [],
  recurring: [],
  recurringStatus: {},
})
