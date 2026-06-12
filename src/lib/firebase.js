import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// Replace with your Firebase config from https://console.firebase.google.com
const firebaseConfig = {
  apiKey: "AIzaSyDx8iBS3jJmXIgr_dj85uOJbj6y_NIgad8",
  authDomain: "chess-coach-d4471.firebaseapp.com",
  projectId: "chess-coach-d4471",
  storageBucket: "chess-coach-d4471.firebasestorage.app",
  messagingSenderId: "4072189253",
  appId: "1:4072189253:web:ce370b0872bb5cfe71a22c",
  measurementId: "G-0PBVWFKLFH"
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
