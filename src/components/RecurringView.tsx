import { useState } from 'react'
import type { Recurring } from '../types'
import { useDispatch, useFinance } from '../store/FinanceStore'
import { findCategory, getInstallmentPlans, isRecurringInMonth, type InstallmentPlan } from '../lib/selectors'
import { formatDay, formatMoney, formatMonthLabel } from '../lib/format'
import { EntryForm, type EntryFormMode } from './EntryForm'
import { Modal } from './Modal'

export function RecurringView({ month }: { month: string }) {
  const { recurring, categories } = useFinance()
  const dispatch = useDispatch()
  const [editing, setEditing] = useState<EntryFormMode | null>(null)
  const [deleting, setDeleting] = useState<Recurring | null>(null)

  const sorted = [...recurring].sort((a, b) => a.dayOfMonth - b.dayOfMonth)
  const groups = [
    { title: 'Despesas fixas e assinaturas', items: sorted.filter((r) => r.type === 'expense') },
    { title: 'Receitas fixas', items: sorted.filter((r) => r.type === 'income') },
  ]
  const monthlyTotal = (list: Recurring[]) =>
    list.filter((r) => isRecurringInMonth(r, month)).reduce((sum, r) => sum + r.amount, 0)

  return (
    <>
      <div className="section-head">
        <p className="hint">
          Itens cadastrados aqui aparecem automaticamente em todos os meses do período. Totais para{' '}
          {formatMonthLabel(month)}.
        </p>
        <button className="btn btn-primary" onClick={() => setEditing({ kind: 'new', month, recurring: true })}>
          + Nova recorrência
        </button>
      </div>

      {groups.map((group) => (
        <section className="card" key={group.title}>
          <header className="card-header">
            <h2>{group.title}</h2>
            <span className="card-header-value">{formatMoney(monthlyTotal(group.items))}/mês</span>
          </header>
          {group.items.length === 0 ? (
            <p className="empty">Nada cadastrado.</p>
          ) : (
            <ul className="item-list">
              {group.items.map((r) => {
                const cat = findCategory(categories, r.categoryId)
                const ended = !!r.endMonth && r.endMonth < month
                return (
                  <li key={r.id} className={!r.active || ended ? 'is-inactive' : ''}>
                    <span className="item-icon" style={{ background: `${cat.color}22`, color: cat.color }} aria-hidden>
                      {cat.icon}
                    </span>
                    <div className="item-main">
                      <span className="item-desc">{r.description}</span>
                      <span className="item-meta">
                        {cat.name} · todo dia {r.dayOfMonth} · desde {formatMonthLabel(r.startMonth)}
                        {r.endMonth && ` até ${formatMonthLabel(r.endMonth)}`}
                      </span>
                    </div>
                    <span className={`item-amount ${r.type}`}>{formatMoney(r.amount)}</span>
                    <button
                      className={`status-btn${r.active ? ' done' : ''}`}
                      onClick={() => dispatch({ type: 'recurring/save', recurring: { ...r, active: !r.active } })}
                      title={r.active ? 'Pausar (deixa de aparecer nos meses)' : 'Reativar'}
                    >
                      {r.active ? 'Ativa' : 'Pausada'}
                    </button>
                    <div className="item-actions">
                      <button
                        className="icon-btn"
                        onClick={() => setEditing({ kind: 'recurring', recurring: r })}
                        aria-label="Editar"
                        title="Editar"
                      >
                        ✎
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => setDeleting(r)}
                        aria-label="Excluir"
                        title="Excluir"
                      >
                        🗑
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}

      <InstallmentPlans />

      {editing && <EntryForm mode={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Modal
          title="Excluir recorrência"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  dispatch({ type: 'recurring/delete', id: deleting.id })
                  setDeleting(null)
                }}
              >
                Excluir de todos os meses
              </button>
            </>
          }
        >
          <p>
            Excluir <strong>{deleting.description}</strong> de <em>todos</em> os meses, inclusive do histórico?
          </p>
          <p className="hint">
            Para manter o histórico, use “Pausar” ou edite o campo “Até” para encerrar a recorrência.
          </p>
        </Modal>
      )}
    </>
  )
}

function InstallmentPlans() {
  const state = useFinance()
  const dispatch = useDispatch()
  const [deleting, setDeleting] = useState<InstallmentPlan | null>(null)
  const plans = getInstallmentPlans(state)
  const active = plans.filter((p) => p.remaining > 0)
  const finished = plans.filter((p) => p.remaining === 0)

  const renderPlan = (p: InstallmentPlan) => {
    const cat = findCategory(state.categories, p.categoryId)
    const next = p.transactions.find((t) => !t.paid)
    return (
      <li key={p.groupId} className={p.remaining === 0 ? 'is-inactive' : ''}>
        <span className="item-icon" style={{ background: `${cat.color}22`, color: cat.color }} aria-hidden>
          {cat.icon}
        </span>
        <div className="item-main">
          <span className="item-desc">{p.description}</span>
          <span className="item-meta">
            {p.paidCount}/{p.count} pagas · total {formatMoney(p.total)}
            {next && ` · próxima ${formatDay(next.date)}`}
          </span>
          <span className="progress" aria-hidden>
            <span style={{ width: `${(p.paidCount / p.count) * 100}%` }} />
          </span>
        </div>
        <span className="item-amount expense" title="Restante a pagar">
          {p.remaining > 0 ? formatMoney(p.remaining) : 'Quitado'}
        </span>
        <span />
        <div className="item-actions">
          <button
            className="icon-btn danger"
            onClick={() => setDeleting(p)}
            aria-label="Excluir parcelamento"
            title="Excluir parcelamento"
          >
            🗑
          </button>
        </div>
      </li>
    )
  }

  return (
    <section className="card">
      <header className="card-header">
        <h2>Parcelamentos em andamento</h2>
        <span className="card-header-value">
          {formatMoney(active.reduce((sum, p) => sum + p.remaining, 0))} a pagar
        </span>
      </header>
      {active.length === 0 ? (
        <p className="empty">Nenhuma compra parcelada em aberto. Use “Parcelado” ao criar um lançamento.</p>
      ) : (
        <ul className="item-list">{active.map(renderPlan)}</ul>
      )}
      {finished.length > 0 && (
        <details className="finished-plans">
          <summary>{finished.length} parcelamento{finished.length > 1 ? 's' : ''} quitado{finished.length > 1 ? 's' : ''}</summary>
          <ul className="item-list">{finished.map(renderPlan)}</ul>
        </details>
      )}

      {deleting && (
        <Modal
          title="Excluir parcelamento"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  dispatch({ type: 'transaction/deleteMany', ids: deleting.transactions.map((t) => t.id) })
                  setDeleting(null)
                }}
              >
                Excluir as {deleting.transactions.length} parcelas
              </button>
            </>
          }
        >
          <p>
            Excluir <strong>{deleting.description}</strong> e todas as suas parcelas, inclusive as já pagas?
          </p>
        </Modal>
      )}
    </section>
  )
}
