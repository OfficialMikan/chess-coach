import React, { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import { useStore } from '../store/useStore';
import { PUZZLES } from '../lib/chess-utils';
import { quickComment } from '../lib/ai';

const THEMES = ['All','Mate','Fork','Pin','Skewer','Discovery','Tactics','Sacrifice'];

export default function PuzzlePage() {
  const { geminiKey, addNotification } = useStore();

  const [theme, setTheme]             = useState('All');
  const [puzzleIdx, setPuzzleIdx]     = useState(0);
  const [chess, setChess]             = useState(() => new Chess(PUZZLES[0].fen));
  const [fen, setFen]                 = useState(PUZZLES[0].fen);
  const [moveIdx, setMoveIdx]         = useState(0);
  const [status, setStatus]           = useState('idle');
  const [showHint, setShowHint]       = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [highlights, setHighlights]   = useState({});
  const [streak, setStreak]           = useState(0);
  const [solved, setSolved]           = useState([]);
  const [commentary, setCommentary]   = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [stats, setStats]             = useState({ correct:0, wrong:0 });

  const filtered = theme === 'All' ? PUZZLES : PUZZLES.filter(p => p.theme === theme);
  const puzzle   = filtered[puzzleIdx % filtered.length];

  const loadPuzzle = useCallback((idx) => {
    const p = filtered[idx % filtered.length];
    const c = new Chess(p.fen);
    setChess(c); setFen(p.fen); setMoveIdx(0);
    setStatus('idle'); setShowHint(false); setShowSolution(false);
    setHighlights({}); setCommentary('');
    setPuzzleIdx(idx % filtered.length);
  }, [filtered]);

  const handleMove = useCallback(async (move) => {
    if (status === 'solved') return;
    const expected = puzzle.solution[moveIdx];
    const played   = move.from + move.to + (move.promotion || '');
    const correct  = played === expected;

    if (correct) {
      const next = moveIdx + 1;
      setMoveIdx(next);
      setHighlights({ [move.from]:'last', [move.to]:'last' });
      setFen(chess.fen());

      if (next >= puzzle.solution.length) {
        setStatus('solved');
        setStreak(s => s + 1);
        setSolved(s => [...new Set([...s, puzzle.id])]);
        setStats(s => ({ ...s, correct: s.correct + 1 }));
        setCommentary('🎉 Excellent! Puzzle solved!');
        addNotification('Puzzle solved! 🎉', 'success');
        if (geminiKey) {
          setAiLoading(true);
          quickComment(
            `Chess puzzle "${puzzle.title}" (${puzzle.theme}) solved! Give one short congratulatory sentence with a tip about this tactic. Max 20 words.`,
            geminiKey, 60
          ).then(txt => setCommentary(c => c + ' 🧑‍🏫 ' + txt)).catch(() => {}).finally(() => setAiLoading(false));
        }
      } else {
        setCommentary('✓ Correct! Keep going…');
      }
    } else {
      setStatus('wrong');
      setHighlights({ [move.from]:'wrong', [move.to]:'wrong' });
      setStreak(0);
      setStats(s => ({ ...s, wrong: s.wrong + 1 }));
      setCommentary('✗ Not the best move. Try again!');
      setTimeout(() => {
        chess.undo();
        setFen(chess.fen());
        setHighlights({});
        setStatus('idle');
      }, 900);
    }
  }, [chess, moveIdx, puzzle, status, geminiKey, addNotification]);

  const flipped = puzzle.fen.includes(' b ');
  const accuracy = stats.correct + stats.wrong > 0
    ? Math.round(stats.correct / (stats.correct + stats.wrong) * 100) : null;

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── LEFT ── */}
      <div style={{ width:220, flexShrink:0, background:'#1e1e1c', borderRight:'1px solid #2e2e2a', display:'flex', flexDirection:'column' }}>
        {/* Theme filter */}
        <div style={{ padding:12, borderBottom:'1px solid #2e2e2a' }}>
          <div className="section-label">Theme</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {THEMES.map(t => (
              <button key={t} onClick={() => { setTheme(t); loadPuzzle(0); }} style={{
                padding:'3px 8px', borderRadius:12, fontSize:10, fontWeight:700, border:'1px solid', cursor:'pointer',
                borderColor: theme === t ? '#81b64c' : '#3a3a37',
                background:  theme === t ? 'rgba(129,182,76,.15)' : 'transparent',
                color:       theme === t ? '#81b64c' : '#6b6860',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding:12, borderBottom:'1px solid #2e2e2a' }}>
          <div className="section-label">Stats</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[
              { l:'Streak',   v: streak,        c:'#d4a843' },
              { l:'Solved',   v: solved.length,  c:'#81b64c' },
              { l:'Correct',  v: stats.correct,  c:'#81b64c' },
              { l:'Accuracy', v: accuracy !== null ? accuracy + '%' : '—', c:'#4a90d9' },
            ].map(s => (
              <div key={s.l} style={{ background:'#222220', border:'1px solid #2e2e2a', borderRadius:8, padding:'8px 0', textAlign:'center' }}>
                <div style={{ fontSize:17, fontWeight:700, color:s.c, fontFamily:"'Playfair Display',serif" }}>{s.v}</div>
                <div style={{ fontSize:10, color:'#6b6860' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Puzzle list */}
        <div style={{ flex:1, overflowY:'auto', padding:8 }}>
          <div className="section-label" style={{ padding:'0 4px' }}>Puzzles</div>
          {filtered.map((p, i) => (
            <div key={p.id} onClick={() => loadPuzzle(i)} style={{
              padding:'9px 10px', borderRadius:8, marginBottom:4, cursor:'pointer', border:'1px solid',
              borderColor: puzzle.id === p.id ? '#81b64c' : '#2e2e2a',
              background:  puzzle.id === p.id ? 'rgba(129,182,76,.08)' : '#222220',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                <span style={{ fontSize:12, fontWeight:600 }}>{p.title}</span>
                {solved.includes(p.id) && <span style={{ color:'#81b64c', fontSize:13 }}>✓</span>}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <span style={{ fontSize:10, color:'#d4a843' }}>★ {p.rating}</span>
                <span style={{ fontSize:10, color:'#6b6860' }}>{p.theme}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CENTER ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 16px', overflowY:'auto' }}>
        {/* Header */}
        <div style={{ width:460, marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:"'Playfair Display',serif", marginBottom:4 }}>{puzzle.title}</div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span className="badge badge-gold">★ {puzzle.rating}</span>
              <span className="badge badge-blue">{puzzle.theme}</span>
              <span style={{ fontSize:11, color: flipped ? '#b58863' : '#f0d9b5', fontWeight:500 }}>
                {flipped ? '🌙 Black' : '☀ White'} to play
              </span>
            </div>
          </div>
          {streak > 1 && (
            <div style={{ textAlign:'center', background:'rgba(212,168,67,.1)', border:'1px solid rgba(212,168,67,.25)', borderRadius:10, padding:'8px 14px' }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#d4a843' }}>🔥 {streak}</div>
              <div style={{ fontSize:10, color:'#6b6860' }}>streak</div>
            </div>
          )}
        </div>

        <ChessBoard
          fen={fen} flipped={flipped}
          onMove={handleMove}
          highlightSquares={highlights}
          interactive={status !== 'solved'}
          boardSize={460}
        />

        {/* Status */}
        {(commentary || status !== 'idle') && (
          <div style={{
            width:460, marginTop:12, padding:'11px 16px', borderRadius:10, fontSize:13, fontWeight:500,
            background: status==='solved' ? 'rgba(129,182,76,.1)' : status==='wrong' ? 'rgba(224,82,82,.1)' : 'rgba(255,255,255,.03)',
            border: `1px solid ${status==='solved'?'rgba(129,182,76,.3)':status==='wrong'?'rgba(224,82,82,.25)':'#2e2e2a'}`,
            color:  status==='solved' ? '#81b64c' : status==='wrong' ? '#e05252' : '#ede9e0',
          }}>
            {commentary || 'Click a piece to begin.'}
            {aiLoading && <span style={{ color:'#6b6860', marginLeft:6 }}>…</span>}
          </div>
        )}

        {/* Controls */}
        <div style={{ display:'flex', gap:8, marginTop:12, width:460 }}>
          {!showHint && status !== 'solved' && (
            <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowHint(true)}>
              💡 Hint
            </button>
          )}
          {showHint && status !== 'solved' && (
            <div style={{ flex:1, padding:'9px 12px', background:'rgba(74,144,217,.08)', border:'1px solid rgba(74,144,217,.25)', borderRadius:8, fontSize:12, color:'#7fb3e8' }}>
              💡 {puzzle.hint}
            </div>
          )}
          {status !== 'solved' && (
            <button className="btn btn-secondary" onClick={() => { setShowSolution(true); setStatus('solved'); }}>
              👁 Solution
            </button>
          )}
          {(status === 'solved' || showSolution) && (
            <button className="btn btn-primary" style={{ flex:1 }} onClick={() => loadPuzzle(puzzleIdx + 1)}>
              Next Puzzle →
            </button>
          )}
        </div>

        {showSolution && (
          <div style={{ width:460, marginTop:8, padding:'9px 14px', background:'rgba(255,255,255,.03)', border:'1px solid #2e2e2a', borderRadius:8, fontSize:12, color:'#a8a49c' }}>
            Solution: <strong style={{ color:'#ede9e0' }}>{puzzle.solution.join(' → ')}</strong>
          </div>
        )}

        {status === 'idle' && !commentary && (
          <div style={{ width:460, marginTop:10, fontSize:12, color:'#6b6860', textAlign:'center' }}>
            Select a piece, then click the destination square.
          </div>
        )}
      </div>

      {/* ── RIGHT — Tactics guide ── */}
      <div style={{ width:230, flexShrink:0, background:'#1e1e1c', borderLeft:'1px solid #2e2e2a', padding:14, overflowY:'auto' }}>
        <div className="section-label">Tactical Motifs</div>
        {[
          { icon:'⚡', name:'Fork',       desc:'Attack two pieces simultaneously with one piece.' },
          { icon:'📌', name:'Pin',        desc:'Piece held in place to protect something more valuable.' },
          { icon:'🎯', name:'Skewer',     desc:'Force a valuable piece to move, exposing one behind it.' },
          { icon:'💥', name:'Discovery',  desc:'Moving one piece reveals an attack by another.' },
          { icon:'🏰', name:'Back Rank',  desc:'Trap the king on the back rank — no escape squares.' },
          { icon:'⚔',  name:'Sacrifice',  desc:'Give up material to gain a decisive positional or mating advantage.' },
          { icon:'🔱', name:'Double Check',desc:'Two pieces give check simultaneously — king must move.' },
          { icon:'🌀', name:'Zwischenzug', desc:'An "in-between" move played before the expected reply.' },
        ].map(m => (
          <div key={m.name} style={{ marginBottom:10, padding:'9px 12px', background:'#222220', borderRadius:8, border:'1px solid #2e2e2a' }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{m.icon} {m.name}</div>
            <div style={{ fontSize:11, color:'#6b6860', lineHeight:1.4 }}>{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
