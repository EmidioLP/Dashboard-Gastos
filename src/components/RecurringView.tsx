import { useState } from 'react'
import type { Recurring } from '../types'
import { useDispatch, useFinance } from '../store/FinanceStore'
import { findCategory, isRecurringInMonth } from '../lib/selectors'
import { formatMoney, formatMonthLabel } from '../lib/format'
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
