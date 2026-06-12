import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { useStore } from '../store/useStore';
import { getUserGames, deleteGame } from '../lib/firebase';
import { buildFenHistory, getMaterialCount } from '../lib/chess-utils';

export default function LibraryPage() {
  const { user, addNotification, setActiveTab } = useStore();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (user) loadGames();
  }, [user]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const g = await getUserGames(user.uid);
      setGames(g);
    } catch(e) { addNotification('Failed to load library', 'error'); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteGame(user.uid, id);
      setGames(g => g.filter(x => x.id !== id));
      addNotification('Game deleted', 'info');
    } catch(e) { addNotification('Delete failed', 'error'); }
  };

  const filtered = games
    .filter(g => filter === 'all' ? true : g.result?.includes(filter))
    .sort((a, b) => sortBy === 'date' ? b.savedAt - a.savedAt : 0);

  const wins = games.filter(g => g.result === 'win' || g.white === 'You' && g.result?.includes('White')).length;
  const losses = games.filter(g => ['checkmated','resigned','timeout','abandoned'].some(r => g.result?.includes(r))).length;

  if (!user) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:16 }}>
        <div style={{ fontSize:48, opacity:.3 }}>📚</div>
        <div style={{ fontSize:18, fontWeight:600, color:'#a8a49c' }}>Sign in to access your library</div>
        <div style={{ fontSize:13, color:'#6b6860' }}>Your saved games will appear here after signing in with Google.</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left stats */}
      <div style={{ width:220, flexShrink:0, background:'#1e1e1c', borderRight:'1px solid #2e2e2a', padding:14, overflowY:'auto' }}>
        <div className="section-label">Overview</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          {[
            { l:'Total', v:games.length, c:'#a8a49c' },
            { l:'Wins', v:wins, c:'#81b64c' },
            { l:'Losses', v:losses, c:'#e05252' },
            { l:'Saved', v:games.filter(g=>g.type==='vs-engine').length, c:'#d4a843' },
          ].map(s => (
            <div key={s.l} style={{ background:'#222220', border:'1px solid #2e2e2a', borderRadius:8, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.c, fontFamily:"'Playfair Display',serif" }}>{s.v}</div>
              <div style={{ fontSize:10, color:'#6b6860' }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div className="section-label">Filter</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {[['all','All Games'],['win','Wins'],['loss','Losses'],['draw','Draws']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ padding:'7px 10px', borderRadius:6, fontSize:12, fontWeight:500, border:'none', cursor:'pointer', textAlign:'left',
                background: filter===v ? 'rgba(129,182,76,.15)' : 'transparent',
                color: filter===v ? '#81b64c' : '#a8a49c',
              }}>{l}</button>
          ))}
        </div>

        <div className="section-label" style={{ marginTop:14 }}>Sort By</div>
        <div style={{ display:'flex', gap:4 }}>
          {[['date','Date'],['result','Result']].map(([v,l]) => (
            <button key={v} onClick={() => setSortBy(v)}
              style={{ flex:1, padding:'5px 0', borderRadius:6, fontSize:11, fontWeight:600, border:'none', cursor:'pointer',
                background: sortBy===v ? '#81b64c' : '#2a2a27', color: sortBy===v ? '#fff' : '#6b6860',
              }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Game list */}
      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20 }}>Game Library</h2>
          <button className="btn btn-secondary btn-sm" onClick={loadGames}>↻ Refresh</button>
        </div>

        {loading && (
          <div style={{ textAlign:'center', padding:40, color:'#6b6860' }}>
            <div style={{ width:24, height:24, border:'2px solid #3a3a37', borderTop:'2px solid #81b64c', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 12px' }}/>
            Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:60, color:'#6b6860' }}>
            <div style={{ fontSize:48, opacity:.3, marginBottom:12 }}>♟</div>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>No saved games yet</div>
            <div style={{ fontSize:13 }}>Play a game in Trainer mode to save it here!</div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10 }}>
          {filtered.map(g => (
            <GameCard key={g.id} game={g} onDelete={() => handleDelete(g.id)} onAnalyze={() => { setActiveTab('analyze'); }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GameCard({ game, onDelete, onAnalyze }) {
  const date = game.savedAt ? new Date(game.savedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
  const isWin = game.result === 'win';
  const isLoss = ['checkmated','resigned','timeout','abandoned'].includes(game.result);
  const resultColor = isWin ? '#81b64c' : isLoss ? '#e05252' : '#d4a843';
  const resultLabel = isWin ? 'WIN' : isLoss ? 'LOSS' : 'DRAW';

  return (
    <div style={{ background:'#222220', border:'1px solid #2e2e2a', borderRadius:12, padding:14, transition:'.15s' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='#3a3a37'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='#2e2e2a'}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:3,
          background: isWin ? 'rgba(129,182,76,.2)' : isLoss ? 'rgba(224,82,82,.2)' : 'rgba(212,168,67,.2)',
          color: resultColor,
        }}>{resultLabel}</span>
        <span style={{ fontSize:10, color:'#6b6860' }}>{date}</span>
      </div>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{game.white} vs {game.black}</div>
      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        {game.type === 'vs-engine' && <span style={{ fontSize:10, color:'#d4a843' }}>vs Engine ({game.elo})</span>}
        {game.elo && <span style={{ fontSize:10, color:'#6b6860' }}>ELO {game.elo}</span>}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={onAnalyze}>📋 Analyze</button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>🗑</button>
      </div>
    </div>
  );
}
