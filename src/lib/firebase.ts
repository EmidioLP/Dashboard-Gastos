import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const env = import.meta.env
const useEmulators = env.VITE_USE_EMULATORS === 'true'

// Web config is not a secret (it ships in the bundle); access is enforced by firestore.rules.
// It still lives in .env.local so the repo stays free of project identifiers.
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId)

interface FirebaseServices {
  auth: Auth
  db: Firestore
  googleProvider: GoogleAuthProvider
}

let services: FirebaseServices | undefined

/** Initialized on first use, so the public demo never touches Firebase. */
export function firebase(): FirebaseServices {
  if (services) return services
  if (!isFirebaseConfigured) throw new Error('Firebase não configurado: preencha o .env.local (veja o README).')

  const app = initializeApp(config)
  const auth = getAuth(app)
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  services = { auth, db, googleProvider: new GoogleAuthProvider() }
  return services
}
