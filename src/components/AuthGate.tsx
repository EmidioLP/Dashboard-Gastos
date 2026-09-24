import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'
import { FinanceProvider } from '../store/FinanceStore'

type Access = 'checking' | 'allowed' | 'denied' | 'error'

export function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [access, setAccess] = useState<Access>('checking')
  const [error, setError] = useState('')

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  useEffect(() => {
    if (!user) return
    setAccess('checking')
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

  if (user === undefined || (user && access === 'checking')) return <Splash text="Carregando…" />

  if (!user) {
    return (
      <Splash>
        <h1>💰 Meus Gastos</h1>
        <p className="hint">Entre com sua conta Google para ver seu dashboard.</p>
        <button
          className="btn btn-primary"
          onClick={() => signInWithPopup(auth, googleProvider).catch((e: Error) => setError(e.message))}
        >
          Entrar com Google
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
        <button className="btn" onClick={() => signOut(auth)}>
          Sair
        </button>
      </Splash>
    )
  }

  return (
    <FinanceProvider uid={user.uid} loading={<Splash text="Carregando seus dados…" />}>
      {children(user)}
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
