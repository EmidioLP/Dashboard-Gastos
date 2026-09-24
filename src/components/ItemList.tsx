import { useState } from 'react'
import type { MonthItem } from '../types'
import { useDispatch, useFinance } from '../store/FinanceStore'
import { findCategory } from '../lib/selectors'
import { formatDay, formatMoney, shiftMonth, today } from '../lib/format'
import { EntryForm, type EntryFormMode } from './EntryForm'
import { Modal } from './Modal'

// Lists can mix months (e.g. recent entries), so recurring actions use each item's own month.
const monthOf = (item: MonthItem) => item.date.slice(0, 7)

interface Props {
  items: MonthItem[]
  emptyText?: string
  compact?: boolean
}

export function ItemList({ items, emptyText = 'Nenhum lançamento.', compact }: Props) {
  const state = useFinance()
  const dispatch = useDispatch()
  const [editing, setEditing] = useState<EntryFormMode | null>(null)
  const [deleting, setDeleting] = useState<MonthItem | null>(null)

  const togglePaid = (item: MonthItem) => {
    if (item.source === 'transaction') dispatch({ type: 'transaction/togglePaid', id: item.sourceId })
    else dispatch({ type: 'recurring/setStatus', id: item.sourceId, month: monthOf(item), patch: { paid: !item.paid } })
  }

  const edit = (item: MonthItem) => {
    if (item.source === 'transaction') {
      const transaction = state.transactions.find((t) => t.id === item.sourceId)
      if (transaction) setEditing({ kind: 'transaction', transaction })
    } else {
      const recurring = state.recurring.find((r) => r.id === item.sourceId)
      if (recurring) setEditing({ kind: 'recurring', recurring, month: monthOf(item) })
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
              <span
                className="item-icon"
                style={{ background: `${cat.color}22`, color: cat.color }}
                onClick={() => edit(item)}
                aria-hidden
              >
                {cat.icon}
              </span>
              <div
                className="item-main"
                role="button"
                tabIndex={0}
                title="Editar"
                onClick={() => edit(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    edit(item)
                  }
                }}
              >
                <span className="item-desc">
                  {item.description}
                  {item.source === 'recurring' && (
                    <span className="tag" title="Lançamento recorrente">
                      ↻ mensal
                    </span>
                  )}
                  {item.installment && (
                    <span className="tag" title={`Parcela ${item.installment.index} de ${item.installment.total}`}>
                      {item.installment.index}/{item.installment.total}
                    </span>
                  )}
                  {item.onCard && (
                    <span className="tag" title="No cartão de crédito">
                      💳
                    </span>
                  )}
                </span>
                <span className="item-meta">
                  {cat.name} · {formatDay(item.date)}
                  {item.purchaseDate && ` · compra em ${formatDay(item.purchaseDate)}`}
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
              <div className="item-actions">
                <button className="icon-btn" onClick={() => edit(item)} aria-label="Editar" title="Editar">
                  ✎
                </button>
                {!compact && (
                  <button className="icon-btn danger" onClick={() => setDeleting(item)} aria-label="Excluir" title="Excluir">
                    🗑
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {editing && <EntryForm mode={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteDialog item={deleting} onClose={() => setDeleting(null)} />}
    </>
  )
}

function DeleteDialog({ item, onClose }: { item: MonthItem; onClose: () => void }) {
  const month = monthOf(item)
  const { recurring, transactions } = useFinance()
  const dispatch = useDispatch()

  if (item.installment) {
    const { groupId, index, total } = item.installment
    const group = transactions.filter((t) => t.installment?.groupId === groupId)
    const remove = (ids: string[]) => {
      dispatch({ type: 'transaction/deleteMany', ids })
      onClose()
    }
    return (
      <Modal title="Excluir parcela" onClose={onClose}>
        <p>
          <strong>{item.description}</strong> é a parcela {index} de {total}. O que deseja excluir?
        </p>
        <div className="choice-list">
          <button className="btn" onClick={() => remove([item.sourceId])}>
            Só esta parcela
          </button>
          {index < total && (
            <button
              className="btn btn-danger"
              onClick={() => remove(group.filter((t) => t.installment!.index >= index).map((t) => t.id))}
            >
              Esta e as próximas
            </button>
          )}
          <button className="btn btn-danger" onClick={() => remove(group.map((t) => t.id))}>
            Todas as parcelas
          </button>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </Modal>
    )
  }

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
      // recurring months are charge months; on the card the charge can be in an earlier month than the bill
      const endMonth = shiftMonth((item.purchaseDate ?? item.date).slice(0, 7), -1)
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
