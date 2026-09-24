import { useMemo, useState } from 'react'
import { signOut, type User } from 'firebase/auth'
import { auth } from './lib/firebase'
import { useFinance } from './store/FinanceStore'
import { currentMonth, formatMonthLabel, shiftMonth } from './lib/format'
import { getDailyExpenses, getExpensesByCategory, getMonthItems, getTotals, getUpcomingBills } from './lib/selectors'
import { SummaryCards } from './components/SummaryCards'
import { CategoryBreakdown } from './components/CategoryBreakdown'
import { DailyChart } from './components/DailyChart'
import { ItemList } from './components/ItemList'
import { EntryForm } from './components/EntryForm'
import { EMPTY_FILTERS, TransactionsView, type Filters } from './components/TransactionsView'
import { RecurringView } from './components/RecurringView'
import { SettingsView } from './components/SettingsView'

type Tab = 'overview' | 'transactions' | 'recurring' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'transactions', label: 'Lançamentos' },
  { id: 'recurring', label: 'Recorrentes' },
  { id: 'settings', label: 'Configurações' },
]

export default function App({ user }: { user: User }) {
  const state = useFinance()
  const [month, setMonth] = useState(currentMonth)
  const [tab, setTab] = useState<Tab>('overview')
  const [adding, setAdding] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  const items = useMemo(() => getMonthItems(state, month), [state, month])
  const previousItems = useMemo(() => getMonthItems(state, shiftMonth(month, -1)), [state, month])
  const totals = getTotals(items)
  const byCategory = getExpensesByCategory(items, state.categories)
  const upcoming = getUpcomingBills(items)

  const showCategory = (categoryId: string) => {
    setFilters({ ...EMPTY_FILTERS, categoryId, type: 'expense' })
    setTab('transactions')
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>💰 Meus Gastos</h1>
        <div className="month-picker">
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior">
            ‹
          </button>
          <span className="month-label">{formatMonthLabel(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês">
            ›
          </button>
          {month !== currentMonth() && (
            <button className="link-btn" onClick={() => setMonth(currentMonth())}>
              Hoje
            </button>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Novo lançamento
        </button>
        <div className="user-menu">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="avatar" aria-hidden>
              {(user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <button className="link-btn" onClick={() => signOut(auth)} title={user.email ?? undefined}>
            Sair
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'overview' && (
          <>
            <SummaryCards totals={totals} previousExpense={getTotals(previousItems).expense} />
            <div className="grid-2">
              <section className="card">
                <header className="card-header">
                  <h2>Onde estou gastando</h2>
                  <span className="card-header-value">{formatMonthLabel(month)}</span>
                </header>
                <CategoryBreakdown data={byCategory} onSelect={showCategory} />
              </section>
              <section className="card">
                <header className="card-header">
                  <h2>Contas a pagar</h2>
                  {upcoming.some((u) => u.overdue) && <span className="badge-warn">⚠ Atrasadas</span>}
                </header>
                <ItemList items={upcoming} month={month} emptyText="Nenhuma conta pendente. 🎉" compact />
              </section>
            </div>
            <section className="card">
              <header className="card-header">
                <h2>Gastos por dia</h2>
              </header>
              <DailyChart data={getDailyExpenses(items, month)} />
            </section>
            <section className="card">
              <header className="card-header">
                <h2>Últimos lançamentos</h2>
                <button className="link-btn" onClick={() => setTab('transactions')}>
                  Ver todos →
                </button>
              </header>
              <ItemList
                items={items.slice(0, 6)}
                month={month}
                emptyText="Nenhum lançamento neste mês. Clique em “+ Novo lançamento” para começar."
              />
            </section>
          </>
        )}
        {tab === 'transactions' && (
          <TransactionsView items={items} month={month} filters={filters} onFiltersChange={setFilters} />
        )}
        {tab === 'recurring' && <RecurringView month={month} />}
        {tab === 'settings' && <SettingsView />}
      </main>

      {adding && <EntryForm mode={{ kind: 'new', month }} onClose={() => setAdding(false)} />}
    </div>
  )
}
