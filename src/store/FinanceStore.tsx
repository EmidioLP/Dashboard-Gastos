import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  FieldPath,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import type {
  CardSettings,
  Category,
  FinanceState,
  Recurring,
  RecurringMonthStatus,
  RecurringStatusMap,
  Transaction,
} from '../types'
import { firebase } from '../lib/firebase'
import { ADDED_DEFAULT_CATEGORY_IDS, DEFAULT_CATEGORIES, OTHER_CATEGORY_ID } from './defaults'
import { createDemoState } from './demoData'
import { reducer } from './reducer'

export type Action =
  | { type: 'transaction/save'; transaction: Transaction }
  | { type: 'transaction/saveMany'; transactions: Transaction[] }
  | { type: 'transaction/delete'; id: string }
  | { type: 'transaction/deleteMany'; ids: string[] }
  | { type: 'transaction/togglePaid'; id: string }
  | { type: 'recurring/save'; recurring: Recurring }
  | { type: 'recurring/delete'; id: string }
  | { type: 'recurring/setStatus'; id: string; month: string; patch: Partial<RecurringMonthStatus> }
  | { type: 'category/save'; category: Category }
  | { type: 'category/delete'; id: string }
  | { type: 'settings/saveCard'; card: CardSettings | null }
  | { type: 'state/replace'; state: FinanceState }
  | { type: 'state/reset' }

type Dispatch = (action: Action) => void

const COLLECTIONS = ['categories', 'transactions', 'recurring'] as const
type CollectionName = (typeof COLLECTIONS)[number]

type Op = { kind: 'set'; ref: DocumentReference; data: object } | { kind: 'delete'; ref: DocumentReference }

/** Firestore batches hold at most 500 writes. */
async function commitOps(ops: Op[]) {
  const { db } = firebase()
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 450)) {
      if (op.kind === 'set') batch.set(op.ref, op.data)
      else batch.delete(op.ref)
    }
    await batch.commit()
  }
}

const withoutId = <T extends { id: string }>({ id: _id, ...rest }: T) => rest

const metaDoc = (uid: string) => doc(firebase().db, 'users', uid, 'settings', 'meta')

/** Records that the later-added default categories were already offered, so deleting one does not bring it back. */
const seenDefaultsOp = (uid: string): Op => ({
  kind: 'set',
  ref: metaDoc(uid),
  data: { seenDefaultCategories: ADDED_DEFAULT_CATEGORY_IDS },
})

/** Creates the default categories added after the account existed, once per account. */
async function backfillDefaultCategories(uid: string, existing: Set<string>) {
  const seen = (await getDoc(metaDoc(uid))).data()?.seenDefaultCategories as string[] | undefined
  if (seen && ADDED_DEFAULT_CATEGORY_IDS.every((id) => seen.includes(id))) return
  // without the marker the account predates it, and the old code already backfilled the current list
  const missing = seen
    ? DEFAULT_CATEGORIES.filter(
        (c) => ADDED_DEFAULT_CATEGORY_IDS.includes(c.id) && !seen.includes(c.id) && !existing.has(c.id),
      )
    : []
  const { db } = firebase()
  await commitOps([
    ...missing.map((c): Op => ({ kind: 'set', ref: doc(db, 'users', uid, 'categories', c.id), data: withoutId(c) })),
    seenDefaultsOp(uid),
  ])
}

export function isFinanceState(value: unknown): value is FinanceState {
  const v = value as FinanceState
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray(v.categories) &&
    Array.isArray(v.transactions) &&
    Array.isArray(v.recurring) &&
    typeof v.recurringStatus === 'object'
  )
}

async function applyAction(uid: string, state: FinanceState, action: Action) {
  const { db } = firebase()
  const col = (name: CollectionName) => collection(db, 'users', uid, name)
  const ref = (name: CollectionName, id: string) => doc(db, 'users', uid, name, id)
  const cardRef = doc(db, 'users', uid, 'settings', 'card')

  const seedOps = (): Op[] => [
    ...DEFAULT_CATEGORIES.map((c): Op => ({ kind: 'set', ref: ref('categories', c.id), data: withoutId(c) })),
    seenDefaultsOp(uid),
  ]

  const wipeOps = async (): Promise<Op[]> => {
    const snaps = await Promise.all(COLLECTIONS.map((name) => getDocs(col(name))))
    return [
      ...snaps.flatMap((s) => s.docs.map((d): Op => ({ kind: 'delete', ref: d.ref }))),
      { kind: 'delete', ref: cardRef },
      { kind: 'delete', ref: metaDoc(uid) },
    ]
  }

  switch (action.type) {
    case 'transaction/save':
      return setDoc(ref('transactions', action.transaction.id), withoutId(action.transaction))
    case 'transaction/saveMany':
      return commitOps(
        action.transactions.map((t): Op => ({ kind: 'set', ref: ref('transactions', t.id), data: withoutId(t) })),
      )
    case 'transaction/delete':
      return deleteDoc(ref('transactions', action.id))
    case 'transaction/deleteMany':
      return commitOps(action.ids.map((id): Op => ({ kind: 'delete', ref: ref('transactions', id) })))
    case 'transaction/togglePaid': {
      const t = state.transactions.find((x) => x.id === action.id)
      if (t) return updateDoc(ref('transactions', t.id), { paid: !t.paid })
      return
    }
    case 'recurring/save': {
      // merge keeps the per-month `status` map; a cleared endMonth must be removed explicitly
      const { endMonth, ...rest } = withoutId(action.recurring)
      return setDoc(ref('recurring', action.recurring.id), { ...rest, endMonth: endMonth ?? deleteField() }, { merge: true })
    }
    case 'recurring/delete':
      return deleteDoc(ref('recurring', action.id))
    case 'recurring/setStatus': {
      const current = state.recurringStatus[action.id]?.[action.month] ?? { paid: false }
      return updateDoc(ref('recurring', action.id), new FieldPath('status', action.month), {
        ...current,
        ...action.patch,
      })
    }
    case 'category/save':
      return setDoc(ref('categories', action.category.id), withoutId(action.category))
    case 'category/delete': {
      if (action.id === OTHER_CATEGORY_ID) return
      const ops: Op[] = [{ kind: 'delete', ref: ref('categories', action.id) }]
      for (const t of state.transactions)
        if (t.categoryId === action.id)
          ops.push({ kind: 'set', ref: ref('transactions', t.id), data: { ...withoutId(t), categoryId: OTHER_CATEGORY_ID } })
      for (const r of state.recurring)
        if (r.categoryId === action.id)
          ops.push({
            kind: 'set',
            ref: ref('recurring', r.id),
            data: { ...withoutId(r), categoryId: OTHER_CATEGORY_ID, status: state.recurringStatus[r.id] ?? {} },
          })
      return commitOps(ops)
    }
    case 'settings/saveCard':
      return action.card ? setDoc(cardRef, action.card) : deleteDoc(cardRef)
    case 'state/replace': {
      const s = action.state
      const categories = s.categories.some((c) => c.id === OTHER_CATEGORY_ID)
        ? s.categories
        : [...s.categories, DEFAULT_CATEGORIES.find((c) => c.id === OTHER_CATEGORY_ID)!]
      const ops: Op[] = [
        ...(await wipeOps()),
        ...categories.map((c): Op => ({ kind: 'set', ref: ref('categories', c.id), data: withoutId(c) })),
        ...s.transactions.map((t): Op => ({ kind: 'set', ref: ref('transactions', t.id), data: withoutId(t) })),
        ...s.recurring.map(
          (r): Op => ({
            kind: 'set',
            ref: ref('recurring', r.id),
            data: { ...withoutId(r), status: s.recurringStatus[r.id] ?? {} },
          }),
        ),
        ...(s.card ? [{ kind: 'set', ref: cardRef, data: s.card } as Op] : []),
        seenDefaultsOp(uid),
      ]
      return commitOps(ops)
    }
    case 'state/reset':
      return commitOps([...(await wipeOps()), ...seedOps()])
  }
}

interface Store {
  state: FinanceState
  dispatch: Dispatch
  isDemo: boolean
}

const StoreContext = createContext<Store | null>(null)

const EMPTY_STATE: FinanceState = { version: 1, categories: [], transactions: [], recurring: [], recurringStatus: {} }

interface ProviderProps {
  uid: string
  children: ReactNode
  loading: ReactNode
}

/** Mirrors users/{uid}/* from Firestore into a FinanceState; actions become Firestore writes. */
export function FinanceProvider({ uid, children, loading }: ProviderProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurringDocs, setRecurringDocs] = useState<(Recurring & { status?: RecurringStatusMap[string] })[]>([])
  const [card, setCard] = useState<CardSettings | undefined>()
  const [loaded, setLoaded] = useState<Set<CollectionName | 'card'>>(new Set())
  const [error, setError] = useState('')
  const seeded = useRef(false)
  const backfilled = useRef(false)

  useEffect(() => {
    const { db } = firebase()
    const markLoaded = (name: CollectionName | 'card') => setLoaded((prev) => (prev.has(name) ? prev : new Set(prev).add(name)))
    const onError = (e: Error) => setError(`Erro ao carregar dados: ${e.message}`)
    const col = (name: CollectionName) => collection(db, 'users', uid, name)

    const unsubs = [
      onSnapshot(
        col('categories'),
        (snap) => {
          // First access: the account has no categories yet on the server, so create the defaults.
          if (snap.empty && !snap.metadata.fromCache && !seeded.current) {
            seeded.current = true
            applyAction(uid, EMPTY_STATE, { type: 'state/reset' }).catch(onError)
          }
          // Existing accounts: create the default categories that were added later.
          if (!snap.empty && !snap.metadata.fromCache && !backfilled.current) {
            backfilled.current = true
            backfillDefaultCategories(uid, new Set(snap.docs.map((d) => d.id))).catch(onError)
          }
          setCategories(snap.docs.map((d) => ({ ...(d.data() as Omit<Category, 'id'>), id: d.id })))
          markLoaded('categories')
        },
        onError,
      ),
      onSnapshot(
        col('transactions'),
        (snap) => {
          setTransactions(snap.docs.map((d) => ({ ...(d.data() as Omit<Transaction, 'id'>), id: d.id })))
          markLoaded('transactions')
        },
        onError,
      ),
      onSnapshot(
        col('recurring'),
        (snap) => {
          setRecurringDocs(snap.docs.map((d) => ({ ...(d.data() as Omit<Recurring, 'id'>), id: d.id })))
          markLoaded('recurring')
        },
        onError,
      ),
      onSnapshot(
        doc(db, 'users', uid, 'settings', 'card'),
        (snap) => {
          setCard(snap.exists() ? (snap.data() as CardSettings) : undefined)
          markLoaded('card')
        },
        onError,
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [uid])

  const state = useMemo<FinanceState>(() => {
    const recurringStatus: RecurringStatusMap = {}
    const recurring = recurringDocs.map(({ status, ...r }) => {
      if (status) recurringStatus[r.id] = status
      return r
    })
    const order = new Map(DEFAULT_CATEGORIES.map((c, i) => [c.id, i]))
    const sortedCategories = [...categories].sort(
      (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) || a.name.localeCompare(b.name),
    )
    return { version: 1, categories: sortedCategories, transactions, recurring, recurringStatus, card }
  }, [categories, transactions, recurringDocs, card])

  const stateRef = useRef(state)
  stateRef.current = state

  const dispatch = useCallback<Dispatch>(
    (action) => {
      applyAction(uid, stateRef.current, action).catch((e: Error) => setError(`Não foi possível salvar: ${e.message}`))
    },
    [uid],
  )

  const store = useMemo(() => ({ state, dispatch, isDemo: false }), [state, dispatch])

  if (loaded.size < COLLECTIONS.length + 1 && !error) return <>{loading}</>

  return (
    <StoreContext.Provider value={store}>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button className="icon-btn" onClick={() => setError('')} aria-label="Fechar">
            ✕
          </button>
        </div>
      )}
      {children}
    </StoreContext.Provider>
  )
}

/** Public demo: fictional data kept only in memory, never sent anywhere. */
export function DemoFinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createDemoState)
  const store = useMemo(() => ({ state, dispatch, isDemo: true }), [state])
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useFinance/useDispatch must be used inside FinanceProvider')
  return store
}

export const useFinance = () => useStore().state
export const useDispatch = () => useStore().dispatch
export const useIsDemo = () => useStore().isDemo
