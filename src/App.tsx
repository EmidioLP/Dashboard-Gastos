import { useMemo, useState } from 'react'
import { useFinance, useIsDemo } from './store/FinanceStore'
import { currentMonth, formatMonthLabel, shiftMonth } from './lib/format'
import {
  getDailyExpenses,
  getExpensesByCategory,
  getMonthItems,
  getRecentItems,
  getTotals,
  getUpcomingBills,
} from './lib/selectors'
import { SummaryCards } from './components/SummaryCards'
import { CategoryBreakdown } from './components/CategoryBreakdown'
import { DailyChart } from './components/DailyChart'
import { ItemList } from './components/ItemList'
import { EntryForm } from './components/EntryForm'
import { EMPTY_FILTERS, TransactionsView, type Filters } from './components/TransactionsView'
import { RecurringView } from './components/RecurringView'
import { SettingsView } from './components/SettingsView'
import { CardBill } from './components/CardBill'

type Tab = 'overview' | 'transactions' | 'recurring' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'transactions', label: 'Lançamentos' },
  { id: 'recurring', label: 'Recorrentes' },
  { id: 'settings', label: 'Configurações' },
]

export interface Account {
  name: string
  photoURL?: string | null
}

interface Props {
  account: Account
  onSignOut: () => void
}

export default function App({ account, onSignOut }: Props) {
  const state = useFinance()
  const isDemo = useIsDemo()
  const [month, setMonth] = useState(currentMonth)
  const [tab, setTab] = useState<Tab>('overview')
  const [adding, setAdding] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  const items = useMemo(() => getMonthItems(state, month), [state, month])
  const previousItems = useMemo(() => getMonthItems(state, shiftMonth(month, -1)), [state, month])
  const totals = getTotals(items)
  const byCategory = getExpensesByCategory(items, state.categories)
  const upcoming = getUpcomingBills(items)
  const recent = useMemo(() => getRecentItems(state, 6), [state])

  const showCategory = (categoryId: string) => {
    setFilters({ ...EMPTY_FILTERS, categoryId, type: 'expense' })
    setTab('transactions')
  }

  const showCardItems = () => {
    setFilters({ ...EMPTY_FILTERS, payment: 'card', type: 'expense' })
    setTab('transactions')
  }

  return (
    <div className="app">
      {isDemo && (
        <div className="demo-banner" role="status">
          <span>
            <strong>Modo demonstração</strong> — todos os valores são fictícios e nada é salvo.
          </span>
          <button className="link-btn" onClick={onSignOut}>
            Sair da demonstração
          </button>
        </div>
      )}
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
        <button className="btn btn-primary" onClick={() => setAdding(true)} aria-label="+ Novo lançamento">
          + Novo<span className="hide-mobile"> lançamento</span>
        </button>
        {!isDemo && (
          <div className="user-menu">
            {account.photoURL ? (
              <img src={account.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar" aria-hidden>
                {account.name.charAt(0).toUpperCase()}
              </span>
            )}
            <button className="link-btn" onClick={onSignOut} title={account.name}>
              Sair
            </button>
          </div>
        )}
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
                <ItemList items={upcoming} emptyText="Nenhuma conta pendente. 🎉" compact />
              </section>
            </div>
            <CardBill items={items} month={month} monthExpense={totals.expense} onShowItems={showCardItems} />
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
                items={recent}
                emptyText="Nenhum lançamento ainda. Clique em “+ Novo lançamento” para começar."
              />
            </section>
          </>
        )}
        {tab === 'transactions' && (
          <TransactionsView items={items} filters={filters} onFiltersChange={setFilters} />
        )}
        {tab === 'recurring' && <RecurringView month={month} />}
        {tab === 'settings' && <SettingsView />}
      </main>

      {adding && <EntryForm mode={{ kind: 'new', month }} onClose={() => setAdding(false)} />}
    </div>
  )
}
