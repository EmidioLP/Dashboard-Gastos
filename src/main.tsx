import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from './components/AuthGate'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>{(account, onSignOut) => <App account={account} onSignOut={onSignOut} />}</AuthGate>
  </StrictMode>,
)
