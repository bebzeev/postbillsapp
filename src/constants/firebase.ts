import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB9wuCSs7WVwjpBNsEigAIHYsciZo0wFYc',
  authDomain: 'eventi-72011.firebaseapp.com',
  projectId: 'eventi-72011',
  storageBucket: 'eventi-72011.firebasestorage.app',
  messagingSenderId: '1080772011295',
  appId: '1:1080772011295:web:6341c33fd257799ada7c2a',
};

let app: ReturnType<typeof initializeApp> | undefined,
  db: ReturnType<typeof getFirestore> | undefined,
  storage: ReturnType<typeof getStorage> | undefined,
  firebaseReady = false;

try {
  app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  storage = getStorage(app, `gs://${FIREBASE_CONFIG.storageBucket}`);
  firebaseReady = true;
} catch {
  console.warn('firebase not initialized (ok for local)');
}

export { app, db, storage, firebaseReady };
