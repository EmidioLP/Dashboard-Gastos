import { useState, type FormEvent } from 'react'
import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Recurring, Transaction, TxType } from '../types'
import { useDispatch, useFinance } from '../store/FinanceStore'
import { INCOME_CATEGORY_ID, OTHER_CATEGORY_ID } from '../store/defaults'
import { formatMoney, parseAmount, today, uid } from '../lib/format'
import {
  MAX_INSTALLMENTS,
  buildInstallments,
  cardInstallmentDates,
  installmentDates,
  splitAmount,
  type InstallmentValueMode,
} from '../lib/installments'
import { Modal } from './Modal'

/**
 * - new: create a one-off transaction, an installment purchase or a recurring entry
 * - transaction: edit a one-off transaction or a single installment
 * - recurring: edit a recurring entry; `month` set means it was opened from that month's list
 */
export type EntryFormMode =
  | { kind: 'new'; month: string; recurring?: boolean }
  | { kind: 'transaction'; transaction: Transaction }
  | { kind: 'recurring'; recurring: Recurring; month?: string }

type Frequency = 'single' | 'installments' | 'monthly'

interface Props {
  mode: EntryFormMode
  onClose: () => void
}

const defaultDateFor = (month: string) => (today().startsWith(month) ? today() : `${month}-01`)

const formatDate = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')

const shortMonth = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMM/yyyy', { locale: ptBR })

export function EntryForm({ mode, onClose }: Props) {
  const { categories, recurringStatus, transactions, card } = useFinance()
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
  const [frequency, setFrequency] = useState<Frequency>(
    mode.kind === 'recurring' || (mode.kind === 'new' && mode.recurring) ? 'monthly' : 'single',
  )
  const [installmentCount, setInstallmentCount] = useState('2')
  const [valueMode, setValueMode] = useState<InstallmentValueMode>('total')
  const [markPastAsPaid, setMarkPastAsPaid] = useState(true)
  const [applyToAllInstallments, setApplyToAllInstallments] = useState(true)
  const [onCard, setOnCard] = useState(true)
  const [dayOfMonth, setDayOfMonth] = useState(String(rec?.dayOfMonth ?? 1))
  const [startMonth, setStartMonth] = useState(rec?.startMonth ?? '')
  const [endMonth, setEndMonth] = useState(rec?.endMonth ?? '')
  const [onlyThisMonth, setOnlyThisMonth] = useState(monthStatus?.amountOverride !== undefined)
  const [error, setError] = useState('')

  const changeType = (next: TxType) => {
    setType(next)
    if (next === 'income' && categories.some((c) => c.id === INCOME_CATEGORY_ID)) setCategoryId(INCOME_CATEGORY_ID)
    if (next === 'expense' && categoryId === INCOME_CATEGORY_ID) setCategoryId(OTHER_CATEGORY_ID)
    if (next === 'income' && frequency === 'installments') setFrequency('single')
  }

  const count = Number(installmentCount)
  const validCount = Number.isInteger(count) && count >= 2 && count <= MAX_INSTALLMENTS
  const parsedAmount = parseAmount(amount)
  const isInstallments = mode.kind === 'new' && frequency === 'installments'
  const cardBilling = isInstallments && onCard ? card : undefined
  const datesFor = (n: number) => (cardBilling ? cardInstallmentDates(date, n, cardBilling) : installmentDates(date, n))
  const preview =
    isInstallments && validCount && Number.isFinite(parsedAmount) && parsedAmount > 0 && date
      ? { amounts: splitAmount(parsedAmount, valueMode, count), dates: datesFor(count) }
      : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = parsedAmount
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

    if (mode.kind === 'new' && frequency === 'monthly') {
      const id = uid()
      const month = date.slice(0, 7)
      dispatch({
        type: 'recurring/save',
        recurring: { id, ...base, amount: value, dayOfMonth: Number(date.slice(8, 10)), startMonth: month, active: true },
      })
      if (paid) dispatch({ type: 'recurring/setStatus', id, month, patch: { paid: true } })
      return onClose()
    }

    if (isInstallments) {
      if (!validCount) return setError(`O número de parcelas deve ser entre 2 e ${MAX_INSTALLMENTS}.`)
      if (valueMode === 'total' && value < count * 0.01) return setError('Valor total pequeno demais para dividir.')
      dispatch({
        type: 'transaction/saveMany',
        transactions: buildInstallments({ base, valueMode, value, dates: datesFor(count), markPastAsPaid }),
      })
      return onClose()
    }

    const saved: Transaction = { id: tx?.id ?? uid(), ...base, amount: value, date, paid, installment: tx?.installment }
    if (tx?.installment && applyToAllInstallments) {
      const siblings = transactions
        .filter((t) => t.installment?.groupId === tx.installment!.groupId && t.id !== tx.id)
        .map((t) => ({ ...t, description: base.description, categoryId, type }))
      dispatch({ type: 'transaction/saveMany', transactions: [saved, ...siblings] })
    } else {
      dispatch({ type: 'transaction/save', transaction: saved })
    }
    onClose()
  }

  const title =
    mode.kind === 'new'
      ? 'Novo lançamento'
      : mode.kind === 'recurring'
        ? 'Editar recorrência'
        : tx?.installment
          ? `Editar parcela ${tx.installment.index}/${tx.installment.total}`
          : 'Editar lançamento'
  const paidLabel = type === 'income' ? 'Já recebido' : 'Já pago'
  const visibleCategories = categories.filter((c) => type === 'income' || c.id !== INCOME_CATEGORY_ID)
  const frequencies: { id: Frequency; label: string }[] = [
    { id: 'single', label: type === 'income' ? 'Uma vez' : 'À vista' },
    ...(type === 'expense' ? [{ id: 'installments' as const, label: 'Parcelado' }] : []),
    { id: 'monthly', label: 'Todo mês' },
  ]
  const amountLabel = isInstallments ? (valueMode === 'total' ? 'Valor total (R$)' : 'Valor da parcela (R$)') : 'Valor (R$)'
  const dateLabel = cardBilling ? 'Data da compra' : isInstallments ? 'Data da 1ª parcela' : frequency === 'monthly' ? 'Primeiro vencimento' : 'Data'
  const hasPastInstallments = !!preview && preview.dates[0] <= today()

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
            placeholder={type === 'income' ? 'Ex.: Salário' : 'Ex.: Mercado, Netflix, Geladeira'}
          />
        </label>

        {mode.kind === 'new' && (
          <div className="field">
            <span>Forma</span>
            <div
              className="segmented"
              role="radiogroup"
              aria-label="Forma"
              style={{ gridTemplateColumns: `repeat(${frequencies.length}, 1fr)` }}
            >
              {frequencies.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={frequency === f.id}
                  className={frequency === f.id ? 'active' : ''}
                  onClick={() => setFrequency(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isInstallments && (
          <div className="field-row">
            <label className="field">
              <span>Nº de parcelas</span>
              <input
                type="number"
                min={2}
                max={MAX_INSTALLMENTS}
                value={installmentCount}
                onChange={(e) => setInstallmentCount(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Informar</span>
              <select value={valueMode} onChange={(e) => setValueMode(e.target.value as InstallmentValueMode)}>
                <option value="total">Valor total da compra</option>
                <option value="parcela">Valor de cada parcela</option>
              </select>
            </label>
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>{amountLabel}</span>
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
            <span>{dateLabel}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}

        {isInstallments && card && (
          <label className="check">
            <input type="checkbox" checked={onCard} onChange={(e) => setOnCard(e.target.checked)} />
            No cartão de crédito
          </label>
        )}

        {preview && (
          <p className="installment-preview" aria-live="polite">
            <InstallmentSummary amounts={preview.amounts} />
            <span>
              {cardBilling
                ? `1ª parcela vence em ${formatDate(preview.dates[0])}`
                : `${shortMonth(preview.dates[0])} a ${shortMonth(preview.dates[preview.dates.length - 1])}`}
            </span>
          </p>
        )}

        {isInstallments
          ? hasPastInstallments && (
              <label className="check">
                <input type="checkbox" checked={markPastAsPaid} onChange={(e) => setMarkPastAsPaid(e.target.checked)} />
                Parcelas com data até hoje já estão pagas
              </label>
            )
          : (mode.kind !== 'recurring' || recMonth) && (
              <label className="check">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
                {paidLabel}
                {mode.kind === 'recurring' || frequency === 'monthly' ? ' neste mês' : ''}
              </label>
            )}

        {tx?.installment && (
          <label className="check">
            <input
              type="checkbox"
              checked={applyToAllInstallments}
              onChange={(e) => setApplyToAllInstallments(e.target.checked)}
            />
            Aplicar descrição e categoria a todas as {tx.installment.total} parcelas
          </label>
        )}

        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}

function InstallmentSummary({ amounts }: { amounts: number[] }) {
  const first = amounts[0]
  const last = amounts[amounts.length - 1]
  const total = amounts.reduce((sum, a) => sum + a, 0)
  return (
    <strong>
      {first === last
        ? `${amounts.length}x de ${formatMoney(first)}`
        : `${amounts.length - 1}x de ${formatMoney(first)} + 1x de ${formatMoney(last)}`}{' '}
      · total {formatMoney(total)}
    </strong>
  )
}
