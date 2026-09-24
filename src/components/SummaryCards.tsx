import { formatMoney } from '../lib/format'

interface Totals {
  income: number
  expense: number
  balance: number
  pending: number
  pendingCount: number
}

interface Props {
  totals: Totals
  previousExpense: number
}

export function SummaryCards({ totals, previousExpense }: Props) {
  const diff = previousExpense ? (totals.expense - previousExpense) / previousExpense : null
  const spentShare = totals.income ? Math.min(totals.expense / totals.income, 1) : 0

  return (
    <section className="cards">
      <article className="card stat">
        <span className="stat-label">Saldo do mês</span>
        <strong className={`stat-value ${totals.balance < 0 ? 'negative' : 'positive'}`}>
          {formatMoney(totals.balance)}
        </strong>
        {totals.income > 0 ? (
          <>
            <div className="meter" role="img" aria-label={`${Math.round(spentShare * 100)}% da receita gasta`}>
              <span style={{ width: `${spentShare * 100}%` }} className={spentShare >= 0.9 ? 'warn' : ''} />
            </div>
            <span className="stat-sub">{Math.round((totals.expense / totals.income) * 100)}% da receita já gasta</span>
          </>
        ) : (
          <span className="stat-sub">Cadastre suas receitas para ver o saldo</span>
        )}
      </article>
      <article className="card stat">
        <span className="stat-label">Receitas</span>
        <strong className="stat-value">{formatMoney(totals.income)}</strong>
      </article>
      <article className="card stat">
        <span className="stat-label">Despesas</span>
        <strong className="stat-value">{formatMoney(totals.expense)}</strong>
        {diff !== null && (
          <span className="stat-sub">
            {diff > 0 ? '▲' : '▼'} {Math.abs(Math.round(diff * 100))}% vs. mês anterior
          </span>
        )}
      </article>
      <article className="card stat">
        <span className="stat-label">A pagar</span>
        <strong className="stat-value">{formatMoney(totals.pending)}</strong>
        <span className="stat-sub">
          {totals.pendingCount === 0
            ? 'Tudo pago 🎉'
            : `${totals.pendingCount} conta${totals.pendingCount > 1 ? 's' : ''} pendente${totals.pendingCount > 1 ? 's' : ''}`}
        </span>
      </article>
    </section>
  )
}
