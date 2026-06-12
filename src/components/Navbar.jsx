import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { signInWithGoogle, signOutUser } from '../lib/firebase';
import { validateKey } from '../lib/ai';

const tabs = [
  { id: 'play',    label: '▶ Play'     },
  { id: 'analyze', label: '📋 Analyze' },
  { id: 'puzzles', label: '🧩 Puzzles' },
  { id: 'library', label: '📚 Library' },
];

export default function Navbar() {
  const { activeTab, setActiveTab, user, setUser, geminiKey, setGeminiKey, addNotification } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput]         = useState(geminiKey);
  const [validating, setValidating]     = useState(false);

  /* ── Auth ── */
  const handleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      if (result.user.email !== 'mikanmnrng@gmail.com') {
        await signOutUser();
        addNotification('⚠ Access restricted to authorised email only', 'error');
        return;
      }
      setUser(result.user);
      addNotification('✓ Welcome back, Mikan!', 'success');
    } catch (e) {
      addNotification('Login failed: ' + e.message, 'error');
    }
  };
  const handleLogout = async () => {
    await signOutUser();
    setUser(null);
    addNotification('Logged out', 'info');
  };

  /* ── Save key with optional validation ── */
  const saveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) { setGeminiKey(''); setShowSettings(false); return; }
    setValidating(true);
    const ok = await validateKey(trimmed);
    setValidating(false);
    if (ok) {
      setGeminiKey(trimmed);
      setShowSettings(false);
      addNotification('Gemini key saved ✓ — Coach Magnus is ready!', 'success');
    } else {
      addNotification('Key invalid or quota exceeded — check it and try again', 'error');
    }
  };

  const hasKey = !!geminiKey;

  return (
    <>
      {/* ── Top bar ── */}
      <nav style={{
        height: 52, background: '#1e1e1c', borderBottom: '1px solid #2e2e2a',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8,
        flexShrink: 0, zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:8 }}>
          <div style={{ width:30, height:30, background:'#81b64c', borderRadius:7,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>♟</div>
          <span style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:'#ede9e0' }}>
            Chess<span style={{ color:'#81b64c' }}>Coach</span>
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, flex:1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding:'6px 14px', borderRadius:6, border:'none', fontSize:12.5, fontWeight:600,
              background: activeTab === t.id ? '#81b64c' : 'transparent',
              color:       activeTab === t.id ? '#fff'    : '#a8a49c',
              cursor: 'pointer', transition: '.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* AI key badge */}
        <button onClick={() => setShowSettings(true)} style={{
          fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:4,
          letterSpacing:.5, cursor:'pointer', border:'1px solid',
          borderColor:  hasKey ? 'rgba(129,182,76,.35)' : '#3a3a37',
          background:   hasKey ? 'rgba(129,182,76,.12)' : 'rgba(100,100,100,.1)',
          color:        hasKey ? '#81b64c'               : '#6b6860',
        }}>
          {hasKey ? 'GEMINI AI ✓' : 'ADD GEMINI KEY'}
        </button>

        {/* User */}
        {user ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <img src={user.photoURL} alt="" style={{ width:28, height:28, borderRadius:'50%', border:'2px solid #81b64c' }}/>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ fontSize:11 }}>Sign Out</button>
          </div>
        ) : (
          <button onClick={handleLogin} className="btn btn-primary btn-sm" style={{ fontSize:12 }}>
            Sign In
          </button>
        )}
      </nav>

      {/* ── Settings modal ── */}
      {showSettings && (
        <div onClick={() => setShowSettings(false)} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.72)', zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#222220', border:'1px solid #383834', borderRadius:16,
            padding:28, width:440, maxWidth:'95vw',
          }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, marginBottom:6 }}>
              🧑‍🏫 Connect Coach Magnus
            </h2>

            {/* Provider explanation */}
            <div style={{ background:'rgba(129,182,76,.08)', border:'1px solid rgba(129,182,76,.2)',
                          borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#a8a49c', lineHeight:1.6 }}>
              <strong style={{ color:'#81b64c' }}>Google Gemini</strong> — free forever, 1,500 requests/day, no credit card.<br/>
              Get your key at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                 style={{ color:'#4a90d9' }}>aistudio.google.com/apikey</a>{' '}
              (sign in with any Google account → Create API key).
            </div>

            <label style={{ fontSize:11, fontWeight:700, letterSpacing:1, color:'#6b6860',
                            textTransform:'uppercase', display:'block', marginBottom:6 }}>
              Gemini API Key
            </label>
            <input
              className="input" type="password"
              value={keyInput} onChange={e => setKeyInput(e.target.value)}
              placeholder="AIza…"
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              style={{ marginBottom:14 }}
            />

            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={saveKey} disabled={validating}>
                {validating ? 'Validating…' : 'Save & Validate'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
            </div>

            {geminiKey && (
              <button onClick={() => { setGeminiKey(''); setKeyInput(''); addNotification('Key removed', 'info'); }}
                style={{ marginTop:10, fontSize:11, color:'#6b6860', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                Remove saved key
              </button>
            )}

            <p style={{ fontSize:11, color:'#6b6860', marginTop:10, lineHeight:1.5 }}>
              🔒 Stored only in your browser's localStorage. Never sent anywhere except Google's API.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
