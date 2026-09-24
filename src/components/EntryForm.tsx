import { useState, type FormEvent } from 'react'
import type { Recurring, Transaction, TxType } from '../types'
import { useDispatch, useFinance } from '../store/FinanceStore'
import { INCOME_CATEGORY_ID, OTHER_CATEGORY_ID } from '../store/defaults'
import { parseAmount, today, uid } from '../lib/format'
import { Modal } from './Modal'

/**
 * - new: create a one-off transaction or (with "repetir todo mês") a recurring entry
 * - transaction: edit a one-off transaction
 * - recurring: edit a recurring entry; `month` set means it was opened from that month's list
 */
export type EntryFormMode =
  | { kind: 'new'; month: string; recurring?: boolean }
  | { kind: 'transaction'; transaction: Transaction }
  | { kind: 'recurring'; recurring: Recurring; month?: string }

interface Props {
  mode: EntryFormMode
  onClose: () => void
}

const defaultDateFor = (month: string) => (today().startsWith(month) ? today() : `${month}-01`)

export function EntryForm({ mode, onClose }: Props) {
  const { categories, recurringStatus } = useFinance()
  const dispatch = useDispatch()

  const tx = mode.kind === 'transaction' ? mode.transaction : undefined
  const rec = mode.kind === 'recurring' ? mode.recurring : undefined
  const recMonth = mode.kind === 'recurring' ? mode.month : undefined
  const monthStatus = rec && recMonth ? recurringStatus[rec.id]?.[recMonth] : undefined

  const [type, setType] = useState<TxType>(tx?.type ?? rec?.type ?? 'expense')
  const [description, setDescription] = useState(tx?.description ?? rec?.description ?? '')
  const [amount, setAmount] = useState(() => {
    const value = tx?.amount ?? monthStatus?.amountOverride ?? rec?.amount
    return value === undefined ? '' : value.toFixed(2).replace('.', ',')
  })
  const [categoryId, setCategoryId] = useState(
    tx?.categoryId ?? rec?.categoryId ?? (categories.find((c) => c.id !== INCOME_CATEGORY_ID)?.id ?? OTHER_CATEGORY_ID),
  )
  const [date, setDate] = useState(tx?.date ?? (mode.kind === 'new' ? defaultDateFor(mode.month) : today()))
  const [paid, setPaid] = useState(tx?.paid ?? monthStatus?.paid ?? false)
  const [repeat, setRepeat] = useState(mode.kind === 'new' ? !!mode.recurring : mode.kind === 'recurring')
  const [dayOfMonth, setDayOfMonth] = useState(String(rec?.dayOfMonth ?? 1))
  const [startMonth, setStartMonth] = useState(rec?.startMonth ?? '')
  const [endMonth, setEndMonth] = useState(rec?.endMonth ?? '')
  const [onlyThisMonth, setOnlyThisMonth] = useState(monthStatus?.amountOverride !== undefined)
  const [error, setError] = useState('')

  const changeType = (next: TxType) => {
    setType(next)
    if (next === 'income' && categories.some((c) => c.id === INCOME_CATEGORY_ID)) setCategoryId(INCOME_CATEGORY_ID)
    if (next === 'expense' && categoryId === INCOME_CATEGORY_ID) setCategoryId(OTHER_CATEGORY_ID)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!description.trim()) return setError('Informe uma descrição.')
    if (!Number.isFinite(value) || value <= 0) return setError('Informe um valor maior que zero.')
    const base = { type, description: description.trim(), categoryId }

    if (mode.kind === 'recurring' && rec) {
      const day = Number(dayOfMonth)
      if (!Number.isInteger(day) || day < 1 || day > 31) return setError('Dia de vencimento deve ser entre 1 e 31.')
      if (!startMonth) return setError('Informe o mês de início.')
      if (endMonth && endMonth < startMonth) return setError('O mês final deve ser depois do início.')
      const keepBaseAmount = recMonth && onlyThisMonth
      dispatch({
        type: 'recurring/save',
        recurring: {
          ...rec,
          ...base,
          amount: keepBaseAmount ? rec.amount : value,
          dayOfMonth: day,
          startMonth,
          endMonth: endMonth || undefined,
        },
      })
      if (recMonth) {
        dispatch({
          type: 'recurring/setStatus',
          id: rec.id,
          month: recMonth,
          patch: { paid, amountOverride: keepBaseAmount ? value : undefined },
        })
      }
      return onClose()
    }

    if (!date) return setError('Informe a data.')

    if (mode.kind === 'new' && repeat) {
      const id = uid()
      const month = date.slice(0, 7)
      dispatch({
        type: 'recurring/save',
        recurring: { id, ...base, amount: value, dayOfMonth: Number(date.slice(8, 10)), startMonth: month, active: true },
      })
      if (paid) dispatch({ type: 'recurring/setStatus', id, month, patch: { paid: true } })
      return onClose()
    }

    dispatch({ type: 'transaction/save', transaction: { id: tx?.id ?? uid(), ...base, amount: value, date, paid } })
    onClose()
  }

  const title =
    mode.kind === 'new' ? 'Novo lançamento' : mode.kind === 'recurring' ? 'Editar recorrência' : 'Editar lançamento'
  const paidLabel = type === 'income' ? 'Já recebido' : 'Já pago'
  const visibleCategories = categories.filter((c) => type === 'income' || c.id !== INCOME_CATEGORY_ID)

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="entry-form" className="btn btn-primary">
            Salvar
          </button>
        </>
      }
    >
      <form id="entry-form" className="form" onSubmit={submit}>
        <div className="segmented" role="radiogroup" aria-label="Tipo">
          <button
            type="button"
            className={type === 'expense' ? 'active expense' : ''}
            onClick={() => changeType('expense')}
          >
            Despesa
          </button>
          <button type="button" className={type === 'income' ? 'active income' : ''} onClick={() => changeType('income')}>
            Receita
          </button>
        </div>

        <label className="field">
          <span>Descrição</span>
          <input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'income' ? 'Ex.: Salário' : 'Ex.: Mercado, Netflix, IPVA'}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Valor (R$)</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </label>
          <label className="field">
            <span>Categoria</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode.kind === 'recurring' ? (
          <>
            <div className="field-row">
              <label className="field">
                <span>Dia do vencimento</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Início</span>
                <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
              </label>
              <label className="field">
                <span>Até (opcional)</span>
                <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
              </label>
            </div>
            {recMonth && (
              <label className="check">
                <input type="checkbox" checked={onlyThisMonth} onChange={(e) => setOnlyThisMonth(e.target.checked)} />
                Valor diferente só neste mês (ex.: conta de luz)
              </label>
            )}
          </>
        ) : (
          <label className="field">
            <span>{repeat ? 'Primeiro vencimento' : 'Data'}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}

        {mode.kind === 'new' && (
          <label className="check">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Repetir todo mês (assinatura, conta fixa, salário…)
          </label>
        )}

        {(mode.kind !== 'recurring' || recMonth) && (
          <label className="check">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            {paidLabel}
            {mode.kind === 'recurring' || repeat ? ' neste mês' : ''}
          </label>
        )}

        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}
