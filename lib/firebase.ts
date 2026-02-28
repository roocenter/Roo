import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCDXenHaJomK5sOk99_B9rRbeBrq2LbDY0',
  authDomain: 'roo-center.firebaseapp.com',
  projectId: 'roo-center',
  storageBucket: 'roo-center.firebasestorage.app',
  messagingSenderId: '763125567747',
  appId: '1:763125567747:web:9f784c3c4471995cae1936',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
