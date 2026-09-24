import type { MonthItem } from '../types'
import { useDispatch, useFinance } from '../store/FinanceStore'
import { formatDay, formatMoney } from '../lib/format'
import { billDueDate } from '../lib/installments'
import { getCardBill } from '../lib/selectors'

interface Props {
  items: MonthItem[]
  month: string
  monthExpense: number
  onShowItems: () => void
}

/** Credit card bill due in the month: its total, share of the month's expenses and a one-click "paid". */
export function CardBill({ items, month, monthExpense, onShowItems }: Props) {
  const { card, transactions } = useFinance()
  const dispatch = useDispatch()
  const bill = getCardBill(items)

  if (!card && !bill.items.length) return null

  const share = monthExpense ? bill.total / monthExpense : 0

  const markPaid = () => {
    const ids = new Set(bill.pendingItems.filter((i) => i.source === 'transaction').map((i) => i.sourceId))
    const paidTransactions = transactions.filter((t) => ids.has(t.id)).map((t) => ({ ...t, paid: true }))
    if (paidTransactions.length) dispatch({ type: 'transaction/saveMany', transactions: paidTransactions })
    for (const i of bill.pendingItems)
      if (i.source === 'recurring')
        dispatch({ type: 'recurring/setStatus', id: i.sourceId, month, patch: { paid: true } })
  }

  return (
    <section className="card">
      <header className="card-header">
        <h2>💳 Fatura do cartão</h2>
        {card && <span className="card-header-value">vence em {formatDay(billDueDate(month, card))}</span>}
      </header>
      {bill.items.length === 0 ? (
        <p className="empty">Nenhuma compra no cartão com vencimento neste mês.</p>
      ) : (
        <div className="card-bill">
          <div className="stat">
            <strong className="stat-value">{formatMoney(bill.total)}</strong>
            <div className="meter" role="img" aria-label={`${Math.round(share * 100)}% das despesas do mês`}>
              <span style={{ width: `${Math.min(share, 1) * 100}%` }} />
            </div>
            <span className="stat-sub">
              {Math.round(share * 100)}% das despesas do mês · {bill.items.length} ite
              {bill.items.length === 1 ? 'm' : 'ns'}
              {bill.pendingItems.length > 0 && ` · ${formatMoney(bill.pending)} pendente`}
            </span>
          </div>
          <div className="button-row">
            {bill.pendingItems.length > 0 ? (
              <button className="btn btn-primary" onClick={markPaid}>
                Marcar fatura como paga
              </button>
            ) : (
              <span className="status-btn done">✓ Fatura paga</span>
            )}
            <button className="link-btn" onClick={onShowItems}>
              Ver itens →
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
