import { useRef, useState } from 'react'
import type { Category } from '../types'
import { useDispatch, useFinance, useIsDemo, isFinanceState } from '../store/FinanceStore'
import { OTHER_CATEGORY_ID } from '../store/defaults'
import { today, uid } from '../lib/format'
import { Modal } from './Modal'

export function SettingsView() {
  return (
    <>
      <CategoryManager />
      <CardSection />
      <BackupSection />
    </>
  )
}

function CategoryManager() {
  const { categories } = useFinance()
  const dispatch = useDispatch()
  const [deleting, setDeleting] = useState<Category | null>(null)

  const save = (category: Category) => dispatch({ type: 'category/save', category })

  return (
    <section className="card">
      <header className="card-header">
        <h2>Categorias</h2>
        <button
          className="btn"
          onClick={() => save({ id: uid(), name: 'Nova categoria', color: '#64748b', icon: '🏷️' })}
        >
          + Categoria
        </button>
      </header>
      <ul className="category-list">
        {categories.map((c) => (
          <li key={c.id}>
            <input
              className="icon-input"
              value={c.icon}
              onChange={(e) => save({ ...c, icon: e.target.value })}
              aria-label="Ícone (emoji)"
              maxLength={4}
            />
            <input
              type="color"
              value={c.color}
              onChange={(e) => save({ ...c, color: e.target.value })}
              aria-label="Cor"
            />
            <input value={c.name} onChange={(e) => save({ ...c, name: e.target.value })} aria-label="Nome" />
            {c.id !== OTHER_CATEGORY_ID && (
              <button className="icon-btn danger" onClick={() => setDeleting(c)} aria-label="Excluir" title="Excluir">
                🗑
              </button>
            )}
          </li>
        ))}
      </ul>

      {deleting && (
        <Modal
          title="Excluir categoria"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  dispatch({ type: 'category/delete', id: deleting.id })
                  setDeleting(null)
                }}
              >
                Excluir
              </button>
            </>
          }
        >
          <p>
            Excluir a categoria <strong>{deleting.name}</strong>? Os lançamentos dela serão movidos para “Outros”.
          </p>
        </Modal>
      )}
    </section>
  )
}

function CardSection() {
  const { card } = useFinance()
  const dispatch = useDispatch()
  const [closingDay, setClosingDay] = useState(card ? String(card.closingDay) : '')
  const [dueDay, setDueDay] = useState(card ? String(card.dueDay) : '')
  const [message, setMessage] = useState('')

  const validDay = (raw: string) => {
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
  }

  const save = () => {
    const closing = validDay(closingDay)
    const due = validDay(dueDay)
    if (closing === null || due === null) return setMessage('Os dias devem ser entre 1 e 31.')
    dispatch({ type: 'settings/saveCard', card: { closingDay: closing, dueDay: due } })
    setMessage('Cartão salvo.')
  }

  const remove = () => {
    dispatch({ type: 'settings/saveCard', card: null })
    setClosingDay('')
    setDueDay('')
    setMessage('Cartão removido.')
  }

  return (
    <section className="card">
      <header className="card-header">
        <h2>Cartão de crédito</h2>
      </header>
      <p className="hint">
        Com o ciclo da fatura configurado, nas compras parceladas no cartão você informa a data da compra e cada parcela
        é lançada no vencimento da fatura em que cai. Compras a partir do dia do fechamento vão para a fatura seguinte.
        Vencimento em fim de semana ou feriado nacional passa para o próximo dia útil.
      </p>
      <div className="field-row">
        <label className="field">
          <span>Dia do fechamento</span>
          <input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
        </label>
        <label className="field">
          <span>Dia do vencimento</span>
          <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </label>
      </div>
      <div className="button-row">
        <button className="btn btn-primary" onClick={save}>
          Salvar
        </button>
        {card && (
          <button className="btn" onClick={remove}>
            Remover
          </button>
        )}
      </div>
      {message && <p className="hint">{message}</p>}
    </section>
  )
}

function BackupSection() {
  const state = useFinance()
  const isDemo = useIsDemo()
  const dispatch = useDispatch()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gastos-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File) => {
    if (!confirm('Importar substitui TODOS os dados atuais pelos do arquivo. Continuar?')) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!isFinanceState(parsed)) throw new Error('invalid')
      dispatch({ type: 'state/replace', state: parsed })
      setMessage('Backup importado com sucesso.')
    } catch {
      setMessage('Arquivo inválido: não é um backup deste dashboard.')
    }
  }

  return (
    <section className="card">
      <header className="card-header">
        <h2>Dados e backup</h2>
      </header>
      <p className="hint">
        {isDemo
          ? 'Na demonstração nada é salvo: os dados são fictícios, ficam só na memória desta aba e voltam ao original ao recarregar.'
          : 'Seus dados ficam salvos na sua conta do Firebase e sincronizam entre dispositivos. Você pode exportar uma cópia em JSON a qualquer momento.'}
      </p>
      <div className="button-row">
        <button className="btn" onClick={exportJson}>
          ⬇ Exportar backup (JSON)
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          ⬆ Importar backup
        </button>
        <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
          Apagar todos os dados
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importJson(file)
            e.target.value = ''
          }}
        />
      </div>
      {message && <p className="hint">{message}</p>}

      {confirmReset && (
        <Modal
          title="Apagar todos os dados"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  dispatch({ type: 'state/reset' })
                  setConfirmReset(false)
                  setMessage('Dados apagados.')
                }}
              >
                Apagar tudo
              </button>
            </>
          }
        >
          <p>Isso remove todos os lançamentos, recorrências e categorias personalizadas. Não dá para desfazer.</p>
        </Modal>
      )}
    </section>
  )
}
