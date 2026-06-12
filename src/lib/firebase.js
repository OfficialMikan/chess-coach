import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// Replace with your Firebase config from https://console.firebase.google.com
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ login_hint: 'mikanmnrng@gmail.com' });

export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = () => signOut(auth);

// Game saves
export const saveGame = async (userId, gameData) => {
  const ref = collection(db, 'users', userId, 'games');
  return addDoc(ref, { ...gameData, savedAt: Date.now() });
};

export const getUserGames = async (userId) => {
  const ref = collection(db, 'users', userId, 'games');
  const q = query(ref, orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const deleteGame = async (userId, gameId) => {
  await deleteDoc(doc(db, 'users', userId, 'games', gameId));
};

export const updateGame = async (userId, gameId, data) => {
  await updateDoc(doc(db, 'users', userId, 'games', gameId), data);
};
