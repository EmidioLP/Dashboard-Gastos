import { useState } from 'react'
import type { MonthItem } from '../types'
import { useDispatch, useFinance } from '../store/FinanceStore'
import { findCategory } from '../lib/selectors'
import { formatDay, formatMoney, shiftMonth, today } from '../lib/format'
import { EntryForm, type EntryFormMode } from './EntryForm'
import { Modal } from './Modal'

interface Props {
  items: MonthItem[]
  month: string
  emptyText?: string
  compact?: boolean
}

export function ItemList({ items, month, emptyText = 'Nenhum lançamento.', compact }: Props) {
  const state = useFinance()
  const dispatch = useDispatch()
  const [editing, setEditing] = useState<EntryFormMode | null>(null)
  const [deleting, setDeleting] = useState<MonthItem | null>(null)

  const togglePaid = (item: MonthItem) => {
    if (item.source === 'transaction') dispatch({ type: 'transaction/togglePaid', id: item.sourceId })
    else dispatch({ type: 'recurring/setStatus', id: item.sourceId, month, patch: { paid: !item.paid } })
  }

  const edit = (item: MonthItem) => {
    if (item.source === 'transaction') {
      const transaction = state.transactions.find((t) => t.id === item.sourceId)
      if (transaction) setEditing({ kind: 'transaction', transaction })
    } else {
      const recurring = state.recurring.find((r) => r.id === item.sourceId)
      if (recurring) setEditing({ kind: 'recurring', recurring, month })
    }
  }

  if (!items.length) return <p className="empty">{emptyText}</p>
  const now = today()

  return (
    <>
      <ul className={`item-list${compact ? ' compact' : ''}`}>
        {items.map((item) => {
          const cat = findCategory(state.categories, item.categoryId)
          const isIncome = item.type === 'income'
          const overdue = !item.paid && !isIncome && item.date < now
          return (
            <li key={item.key} className={item.paid ? 'is-paid' : ''}>
              <span className="item-icon" style={{ background: `${cat.color}22`, color: cat.color }} aria-hidden>
                {cat.icon}
              </span>
              <div className="item-main">
                <span className="item-desc">
                  {item.description}
                  {item.source === 'recurring' && (
                    <span className="tag" title="Lançamento recorrente">
                      ↻ mensal
                    </span>
                  )}
                </span>
                <span className="item-meta">
                  {cat.name} · {formatDay(item.date)}
                </span>
              </div>
              <span className={`item-amount ${isIncome ? 'income' : 'expense'}`}>
                {isIncome ? '+' : '−'} {formatMoney(item.amount)}
              </span>
              <button
                className={`status-btn${item.paid ? ' done' : overdue ? ' overdue' : ''}`}
                onClick={() => togglePaid(item)}
                title={item.paid ? 'Marcar como pendente' : isIncome ? 'Marcar como recebido' : 'Marcar como pago'}
              >
                {item.paid ? (isIncome ? '✓ Recebido' : '✓ Pago') : overdue ? '⚠ Atrasada' : 'Pendente'}
              </button>
              {!compact && (
                <div className="item-actions">
                  <button className="icon-btn" onClick={() => edit(item)} aria-label="Editar" title="Editar">
                    ✎
                  </button>
                  <button className="icon-btn danger" onClick={() => setDeleting(item)} aria-label="Excluir" title="Excluir">
                    🗑
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {editing && <EntryForm mode={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteDialog item={deleting} month={month} onClose={() => setDeleting(null)} />}
    </>
  )
}

function DeleteDialog({ item, month, onClose }: { item: MonthItem; month: string; onClose: () => void }) {
  const { recurring } = useFinance()
  const dispatch = useDispatch()

  if (item.source === 'transaction') {
    return (
      <Modal
        title="Excluir lançamento"
        onClose={onClose}
        footer={
          <>
            <button className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                dispatch({ type: 'transaction/delete', id: item.sourceId })
                onClose()
              }}
            >
              Excluir
            </button>
          </>
        }
      >
        <p>
          Excluir <strong>{item.description}</strong> ({formatMoney(item.amount)})?
        </p>
      </Modal>
    )
  }

  const rec = recurring.find((r) => r.id === item.sourceId)
  const removeThisMonth = () => {
    dispatch({ type: 'recurring/setStatus', id: item.sourceId, month, patch: { skipped: true } })
    onClose()
  }
  const endFromThisMonth = () => {
    if (rec) {
      const endMonth = shiftMonth(month, -1)
      if (endMonth < rec.startMonth) dispatch({ type: 'recurring/delete', id: rec.id })
      else dispatch({ type: 'recurring/save', recurring: { ...rec, endMonth } })
    }
    onClose()
  }

  return (
    <Modal title="Remover recorrência" onClose={onClose}>
      <p>
        <strong>{item.description}</strong> se repete todo mês. O que deseja fazer?
      </p>
      <div className="choice-list">
        <button className="btn" onClick={removeThisMonth}>
          Remover só deste mês
        </button>
        <button className="btn btn-danger" onClick={endFromThisMonth}>
          Encerrar a partir deste mês
        </button>
        <button className="btn" onClick={onClose}>
          Cancelar
        </button>
      </div>
      <p className="hint">Os meses anteriores continuam no histórico.</p>
    </Modal>
  )
}
