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
}

export const EMPTY_FILTERS: Filters = { search: '', type: 'all', categoryId: '', status: 'all' }

interface Props {
  items: MonthItem[]
  month: string
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

export function TransactionsView({ items, month, filters, onFiltersChange }: Props) {
  const { categories } = useFinance()
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onFiltersChange({ ...filters, [key]: value })

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return items.filter(
      (i) =>
        (filters.type === 'all' || i.type === filters.type) &&
        (!filters.categoryId || i.categoryId === filters.categoryId) &&
        (filters.status === 'all' || (filters.status === 'paid') === i.paid) &&
        (!q || i.description.toLowerCase().includes(q)),
    )
  }, [items, filters])

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
        <select value={filters.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
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
        month={month}
        emptyText={hasFilters ? 'Nenhum lançamento com esses filtros.' : 'Nenhum lançamento neste mês.'}
      />
    </section>
  )
}
