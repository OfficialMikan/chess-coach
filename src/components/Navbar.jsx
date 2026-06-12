import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { signInWithGoogle, signOutUser } from '../lib/firebase';

const tabs = [
  { id:'play', label:'▶ Play', icon:'♟' },
  { id:'analyze', label:'📋 Analyze', icon:'📋' },
  { id:'puzzles', label:'🧩 Puzzles', icon:'🧩' },
  { id:'library', label:'📚 Library', icon:'📚' },
];

export default function Navbar() {
  const { activeTab, setActiveTab, user, setUser, apiKey, setApiKey, addNotification } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey);

  const handleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      if (result.user.email !== 'mikanmnrng@gmail.com') {
        await signOutUser();
        addNotification('⚠ Access restricted to authorized email only', 'error');
        return;
      }
      setUser(result.user);
      addNotification('✓ Welcome back, Mikan!', 'success');
    } catch(e) {
      addNotification('Login failed: ' + e.message, 'error');
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setUser(null);
    addNotification('Logged out', 'info');
  };

  const saveKey = () => {
    setApiKey(keyInput);
    setShowSettings(false);
    addNotification('API key saved ✓', 'success');
  };

  return (
    <>
      <nav style={{
        height:52, background:'#1e1e1c', borderBottom:'1px solid #2e2e2a',
        display:'flex', alignItems:'center', padding:'0 16px', gap:8,
        flexShrink:0, zIndex:20, position:'relative',
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:8 }}>
          <div style={{ width:30, height:30, background:'#81b64c', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>♟</div>
          <span style={{ fontFamily:"'Playfair Display', serif", fontSize:17, fontWeight:700, color:'#ede9e0' }}>
            Chess<span style={{color:'#81b64c'}}>Coach</span>
          </span>
        </div>

        {/* Nav tabs */}
        <div style={{ display:'flex', gap:2, flex:1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding:'6px 14px', borderRadius:6, border:'none', fontSize:12.5, fontWeight:600,
                background: activeTab===t.id ? '#81b64c' : 'transparent',
                color: activeTab===t.id ? '#fff' : '#a8a49c',
                cursor:'pointer', transition:'.15s', letterSpacing:.2,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* API badge */}
          <div onClick={() => setShowSettings(true)}
            style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:4, letterSpacing:.5, cursor:'pointer',
              background: apiKey ? 'rgba(129,182,76,.15)' : 'rgba(100,100,100,.15)',
              border: apiKey ? '1px solid rgba(129,182,76,.3)' : '1px solid #3a3a37',
              color: apiKey ? '#81b64c' : '#6b6860',
            }}>
            {apiKey ? 'CLAUDE ✓' : 'ADD API KEY'}
          </div>

          {/* User */}
          {user ? (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <img src={user.photoURL} alt="" style={{ width:28, height:28, borderRadius:'50%', border:'2px solid #81b64c' }}/>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ fontSize:11 }}>Sign Out</button>
            </div>
          ) : (
            <button onClick={handleLogin} className="btn btn-primary btn-sm" style={{ fontSize:12 }}>
              Sign In with Google
            </button>
          )}
        </div>
      </nav>

      {/* Settings modal */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
          onClick={() => setShowSettings(false)}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:'#222220', border:'1px solid #383834', borderRadius:16, padding:28, width:420, maxWidth:'95vw' }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, marginBottom:6 }}>Settings</h2>
            <p style={{ fontSize:13, color:'#a8a49c', marginBottom:20, lineHeight:1.5 }}>
              Enter your Claude API key to enable AI coaching. Get one at console.anthropic.com
            </p>
            <label style={{ fontSize:11, fontWeight:700, letterSpacing:1, color:'#6b6860', textTransform:'uppercase', display:'block', marginBottom:6 }}>Claude API Key</label>
            <input className="input" type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)}
              placeholder="sk-ant-api03-…" style={{ marginBottom:16 }}/>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={saveKey}>Save Key</button>
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
            </div>
            <p style={{ fontSize:11, color:'#6b6860', marginTop:12 }}>🔒 Key stored locally in your browser only.</p>
          </div>
        </div>
      )}
    </>
  );
}
