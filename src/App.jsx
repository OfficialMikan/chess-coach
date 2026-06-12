import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Navbar from './components/Navbar';
import Notifications from './components/Notifications';
import PlayPage from './pages/PlayPage';
import AnalyzePage from './pages/AnalyzePage';
import PuzzlePage from './pages/PuzzlePage';
import LibraryPage from './pages/LibraryPage';
import './index.css';

export default function App() {
  const { activeTab, setUser } = useStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && u.email === 'mikanmnrng@gmail.com') setUser(u);
      else setUser(null);
    });
    return unsub;
  }, [setUser]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#1a1a18' }}>
      <Navbar />
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {activeTab === 'play'    && <PlayPage />}
        {activeTab === 'analyze' && <AnalyzePage />}
        {activeTab === 'puzzles' && <PuzzlePage />}
        {activeTab === 'library' && <LibraryPage />}
      </div>
      <Notifications />
    </div>
  );
}
