import { useMemo } from 'react'
import type { MonthItem } from '../types'
import { useFinance } from '../store/FinanceStore'
import { formatMoney } from '../lib/format'
import { getTotals } from '../lib/selectors'
import { ItemList } from './ItemList'

export interface Filters {
  search: string
  type: 'all' | 'income' | 'expense'
  categoryId: string
  status: 'all' | 'paid' | 'pending'
  payment: 'all' | 'card' | 'other'
}

export const EMPTY_FILTERS: Filters = { search: '', type: 'all', categoryId: '', status: 'all', payment: 'all' }

interface Props {
  items: MonthItem[]
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

export function TransactionsView({ items, filters, onFiltersChange }: Props) {
  const { categories, card } = useFinance()
  const showPayment = !!card || items.some((i) => i.onCard) || filters.payment !== 'all'
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onFiltersChange({ ...filters, [key]: value })
  // a filtered category that was deleted meanwhile counts as "all categories"
  const categoryId = categories.some((c) => c.id === filters.categoryId) ? filters.categoryId : ''

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return items.filter(
      (i) =>
        (filters.type === 'all' || i.type === filters.type) &&
        (!categoryId || i.categoryId === categoryId) &&
        (filters.status === 'all' || (filters.status === 'paid') === i.paid) &&
        (filters.payment === 'all' || (filters.payment === 'card') === !!i.onCard) &&
        (!q || i.description.toLowerCase().includes(q)),
    )
  }, [items, filters, categoryId])

  const totals = getTotals(filtered)
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <section className="card">
      <div className="filters">
        <input
          type="search"
          placeholder="Buscar descrição…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
        <select value={filters.type} onChange={(e) => set('type', e.target.value as Filters['type'])}>
          <option value="all">Receitas e despesas</option>
          <option value="expense">Só despesas</option>
          <option value="income">Só receitas</option>
        </select>
        <select value={categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])}>
          <option value="all">Qualquer status</option>
          <option value="pending">Pendentes</option>
          <option value="paid">Pagos / recebidos</option>
        </select>
        {showPayment && (
          <select value={filters.payment} onChange={(e) => set('payment', e.target.value as Filters['payment'])}>
            <option value="all">Qualquer forma de pagamento</option>
            <option value="card">Só cartão de crédito</option>
            <option value="other">Fora do cartão</option>
          </select>
        )}
        {hasFilters && (
          <button className="link-btn" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
            Limpar filtros
          </button>
        )}
      </div>

      <p className="list-summary">
        {filtered.length} lançamento{filtered.length === 1 ? '' : 's'} · Receitas{' '}
        <strong className="income">{formatMoney(totals.income)}</strong> · Despesas{' '}
        <strong className="expense">{formatMoney(totals.expense)}</strong>
      </p>

      <ItemList
        items={filtered}
        emptyText={hasFilters ? 'Nenhum lançamento com esses filtros.' : 'Nenhum lançamento neste mês.'}
      />
    </section>
  )
}
