import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { firebase, isFirebaseConfigured } from '../lib/firebase'
import { DemoFinanceProvider, FinanceProvider } from '../store/FinanceStore'
import type { Account } from '../App'

type Access = 'checking' | 'allowed' | 'denied' | 'error'

const DEMO_PARAM = 'demo'
const isDemoUrl = () => new URLSearchParams(location.search).has(DEMO_PARAM)

function setDemoUrl(on: boolean) {
  const url = new URL(location.href)
  if (on) url.searchParams.set(DEMO_PARAM, '')
  else url.searchParams.delete(DEMO_PARAM)
  history.replaceState(null, '', url.toString().replace(/=(?=&|$)/, ''))
}

type Render = (account: Account, onSignOut: () => void) => ReactNode

export function AuthGate({ children }: { children: Render }) {
  const [demo, setDemo] = useState(isDemoUrl)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [access, setAccess] = useState<Access>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    if (demo || !isFirebaseConfigured) return
    return onAuthStateChanged(firebase().auth, setUser)
  }, [demo])

  useEffect(() => {
    if (!user) return
    setAccess('checking')
    const { db } = firebase()
    // Only accounts with a document at allowed/{uid} (created by hand in the console) get in.
    getDoc(doc(db, 'allowed', user.uid))
      .then((snap) => setAccess(snap.exists() ? 'allowed' : 'denied'))
      .catch((e: { code?: string; message: string }) => {
        if (e.code === 'permission-denied') setAccess('denied')
        else {
          setError(e.message)
          setAccess('error')
        }
      })
  }, [user])

  const toggleDemo = (on: boolean) => {
    setDemoUrl(on)
    setDemo(on)
  }

  if (demo) {
    return (
      <DemoFinanceProvider>
        {children({ name: 'Visitante' }, () => toggleDemo(false))}
      </DemoFinanceProvider>
    )
  }

  if (!isFirebaseConfigured) {
    return (
      <Splash>
        <h1>💰 Meus Gastos</h1>
        <p className="hint">
          O Firebase não está configurado neste ambiente (veja o README). Você ainda pode explorar o app com dados
          fictícios.
        </p>
        <button className="btn btn-primary" onClick={() => toggleDemo(true)}>
          Ver demonstração
        </button>
      </Splash>
    )
  }

  if (user === undefined || (user && access === 'checking')) return <Splash text="Carregando…" />

  if (!user) {
    return (
      <Splash>
        <h1>💰 Meus Gastos</h1>
        <p className="hint">Entre com sua conta Google para ver seu dashboard.</p>
        <button
          className="btn btn-primary"
          onClick={() => signInWithPopup(firebase().auth, firebase().googleProvider).catch((e: Error) => setError(e.message))}
        >
          Entrar com Google
        </button>
        <button className="link-btn" onClick={() => toggleDemo(true)}>
          Ver demonstração com dados fictícios →
        </button>
        {error && <p className="form-error">{error}</p>}
      </Splash>
    )
  }

  if (access !== 'allowed') {
    return (
      <Splash>
        <h1>{access === 'denied' ? 'Conta não autorizada' : 'Erro de conexão'}</h1>
        {access === 'denied' ? (
          <>
            <p className="hint">
              Este dashboard é privado. Se esta é a sua conta, crie no Firestore o documento{' '}
              <code>allowed/&lt;UID&gt;</code> com o UID abaixo e recarregue a página.
            </p>
            <code className="uid-box">{user.uid}</code>
          </>
        ) : (
          <p className="form-error">{error}</p>
        )}
        <button className="btn" onClick={() => signOut(firebase().auth)}>
          Sair
        </button>
      </Splash>
    )
  }

  return (
    <FinanceProvider uid={user.uid} loading={<Splash text="Carregando seus dados…" />}>
      {children({ name: user.displayName ?? user.email ?? 'Usuário', photoURL: user.photoURL }, () => signOut(firebase().auth))}
    </FinanceProvider>
  )
}

function Splash({ text, children }: { text?: string; children?: ReactNode }) {
  return (
    <div className="splash">
      <div className="splash-card">{children ?? <p className="hint">{text}</p>}</div>
    </div>
  )
}
