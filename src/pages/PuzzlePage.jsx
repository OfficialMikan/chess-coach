import React, { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import { useStore } from '../store/useStore';
import { PUZZLES } from '../lib/chess-utils';

const THEMES = ['All', 'Mate', 'Fork', 'Pin', 'Skewer', 'Discovery', 'Tactics', 'Sacrifice'];

export default function PuzzlePage() {
  const { apiKey, addNotification } = useStore();
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [chess, setChess] = useState(() => new Chess(PUZZLES[0].fen));
  const [fen, setFen] = useState(PUZZLES[0].fen);
  const [moveIdx, setMoveIdx] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | correct | wrong | solved
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [highlights, setHighlights] = useState({});
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState([]);
  const [theme, setTheme] = useState('All');
  const [commentary, setCommentary] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, total: 0 });

  const puzzle = PUZZLES[puzzleIdx];
  const filteredPuzzles = theme === 'All' ? PUZZLES : PUZZLES.filter(p => p.theme === theme);

  const loadPuzzle = useCallback((idx) => {
    const p = filteredPuzzles[idx % filteredPuzzles.length];
    const c = new Chess(p.fen);
    setChess(c);
    setFen(p.fen);
    setMoveIdx(0);
    setStatus('idle');
    setShowHint(false);
    setShowSolution(false);
    setHighlights({});
    setCommentary('');
    setPuzzleIdx(PUZZLES.indexOf(p));
  }, [filteredPuzzles]);

  const handleMove = useCallback(async (move) => {
    if (status === 'solved' || status === 'wrong') return;
    const expectedLan = puzzle.solution[moveIdx];
    const moveLan = move.from + move.to + (move.promotion || '');
    const isCorrect = moveLan === expectedLan;

    if (isCorrect) {
      const newMoveIdx = moveIdx + 1;
      setMoveIdx(newMoveIdx);
      setHighlights({ [move.from]:'last', [move.to]:'last' });
      setFen(chess.fen());

      if (newMoveIdx >= puzzle.solution.length) {
        setStatus('solved');
        setStreak(s => s + 1);
        setSolved(s => [...s, puzzle.id]);
        setStats(s => ({ ...s, correct: s.correct+1, total: s.total+1 }));
        setCommentary('🎉 Excellent! Puzzle solved! ' + (puzzle.solution.length > 1 ? `All ${puzzle.solution.length} moves correct!` : ''));
        addNotification('Puzzle solved! 🎉', 'success');
        if (apiKey) getAiComment(move.san, true);
      } else {
        setCommentary('✓ Correct! Keep going…');
      }
    } else {
      setStatus('wrong');
      setHighlights({ [move.from]:'wrong', [move.to]:'wrong' });
      setStreak(0);
      setStats(s => ({ ...s, wrong: s.wrong+1, total: s.total+1 }));
      setCommentary('✗ Not quite — that was not the best move. Try again or use the hint!');
      setTimeout(() => {
        // Undo the wrong move
        chess.undo();
        setFen(chess.fen());
        setHighlights({});
        setStatus('idle');
      }, 1000);
    }
  }, [chess, moveIdx, puzzle, status, apiKey, addNotification]);

  const getAiComment = useCallback(async (san, correct) => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const prompt = `Chess puzzle: "${puzzle.title}" (theme: ${puzzle.theme}). Player played ${san}${correct?' correctly':' incorrectly'}. Give one encouraging sentence of coaching feedback. Max 20 words.`;
      const res = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:60,messages:[{role:'user',content:prompt}]})
      });
      const d = await res.json();
      const txt = d.content?.[0]?.text;
      if (txt) setCommentary(c => c + ' 🧑‍🏫 ' + txt);
    } catch(e){}
    setLoading(false);
  }, [apiKey, puzzle]);

  const nextPuzzle = () => {
    const current = filteredPuzzles.indexOf(puzzle);
    loadPuzzle((current + 1) % filteredPuzzles.length);
  };

  const flipped = puzzle ? puzzle.fen.includes(' b ') : false;

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left — Puzzle list */}
      <div style={{ width:220, flexShrink:0, background:'#1e1e1c', borderRight:'1px solid #2e2e2a', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:12, borderBottom:'1px solid #2e2e2a' }}>
          <div className="section-label">Theme Filter</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {THEMES.map(t => (
              <button key={t} onClick={() => { setTheme(t); loadPuzzle(0); }}
                style={{ padding:'3px 8px', borderRadius:12, fontSize:10, fontWeight:700, border:'1px solid', cursor:'pointer',
                  borderColor: theme===t ? '#81b64c' : '#3a3a37',
                  background: theme===t ? 'rgba(129,182,76,.15)' : 'transparent',
                  color: theme===t ? '#81b64c' : '#6b6860',
                }}>{t}</button>
            ))}
          </div>
        </div>
        {/* Stats */}
        <div style={{ padding:12, borderBottom:'1px solid #2e2e2a' }}>
          <div className="section-label">Your Stats</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[{l:'Streak',v:streak,c:'#d4a843'},{l:'Solved',v:solved.length,c:'#81b64c'},{l:'Correct',v:stats.correct,c:'#81b64c'},{l:'Total',v:stats.total,c:'#a8a49c'}].map(s=>(
              <div key={s.l} style={{ background:'#222220', border:'1px solid #2e2e2a', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:700, color:s.c, fontFamily:"'Playfair Display',serif" }}>{s.v}</div>
                <div style={{ fontSize:10, color:'#6b6860' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Puzzle list */}
        <div style={{ flex:1, overflowY:'auto', padding:8 }}>
          <div className="section-label" style={{ padding:'0 4px' }}>Puzzles</div>
          {filteredPuzzles.map((p, i) => (
            <div key={p.id} onClick={() => loadPuzzle(i)}
              style={{ padding:'9px 10px', borderRadius:8, marginBottom:5, cursor:'pointer', border:'1px solid',
                borderColor: puzzle.id===p.id ? '#81b64c' : '#2e2e2a',
                background: puzzle.id===p.id ? 'rgba(129,182,76,.08)' : '#222220',
              }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:12, fontWeight:600 }}>{p.title}</span>
                {solved.includes(p.id) && <span style={{ fontSize:12, color:'#81b64c' }}>✓</span>}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <span style={{ fontSize:10, color:'#d4a843' }}>★ {p.rating}</span>
                <span style={{ fontSize:10, color:'#6b6860' }}>{p.theme}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER — Board */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'20px 16px', overflowY:'auto' }}>
        {/* Puzzle header */}
        <div style={{ width:460, marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:"'Playfair Display',serif", marginBottom:2 }}>{puzzle.title}</div>
            <div style={{ display:'flex', gap:6 }}>
              <span className="badge badge-gold">★ {puzzle.rating}</span>
              <span className="badge badge-blue">{puzzle.theme}</span>
              <span style={{ fontSize:11, color: puzzle.fen.includes(' w ') ? '#f0d9b5' : '#b58863', fontWeight:500 }}>
                {puzzle.fen.includes(' w ') ? '☀ White' : '🌙 Black'} to play
              </span>
            </div>
          </div>
          {streak > 0 && (
            <div style={{ textAlign:'center', background:'rgba(212,168,67,.12)', border:'1px solid rgba(212,168,67,.3)', borderRadius:10, padding:'8px 14px' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#d4a843' }}>🔥 {streak}</div>
              <div style={{ fontSize:10, color:'#6b6860' }}>streak</div>
            </div>
          )}
        </div>

        <ChessBoard fen={fen} flipped={flipped} onMove={handleMove} highlightSquares={highlights} interactive={status !== 'solved'} boardSize={460}/>

        {/* Status */}
        {commentary && (
          <div style={{ width:460, marginTop:12, padding:'12px 16px', borderRadius:10, fontSize:13, fontWeight:500,
            background: status==='solved' ? 'rgba(129,182,76,.12)' : status==='wrong' ? 'rgba(224,82,82,.12)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${status==='solved'?'rgba(129,182,76,.3)':status==='wrong'?'rgba(224,82,82,.3)':'#2e2e2a'}`,
            color: status==='solved' ? '#81b64c' : status==='wrong' ? '#e05252' : '#ede9e0',
          }}>
            {commentary}
            {loading && <span style={{ color:'#6b6860', marginLeft:8 }}>…</span>}
          </div>
        )}

        {/* Controls */}
        <div style={{ display:'flex', gap:8, marginTop:12, width:460 }}>
          {!showHint && status !== 'solved' && (
            <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => { setShowHint(true); }}>
              💡 Hint
            </button>
          )}
          {showHint && status !== 'solved' && (
            <div style={{ flex:1, padding:'8px 12px', background:'rgba(74,144,217,.1)', border:'1px solid rgba(74,144,217,.3)', borderRadius:8, fontSize:12, color:'#7fb3e8' }}>
              💡 {puzzle.hint}
            </div>
          )}
          {status !== 'solved' && (
            <button className="btn btn-secondary" onClick={() => { setShowSolution(true); setStatus('solved'); }}>
              👁 Solution
            </button>
          )}
          {(status === 'solved' || showSolution) && (
            <button className="btn btn-primary" style={{ flex:1 }} onClick={nextPuzzle}>
              Next Puzzle →
            </button>
          )}
        </div>

        {showSolution && (
          <div style={{ width:460, marginTop:8, padding:'10px 14px', background:'rgba(255,255,255,.04)', border:'1px solid #2e2e2a', borderRadius:8, fontSize:12, color:'#a8a49c' }}>
            Solution: <strong style={{ color:'#ede9e0' }}>{puzzle.solution.join(', ')}</strong>
          </div>
        )}

        {/* How to solve hint */}
        {status === 'idle' && !commentary && (
          <div style={{ width:460, marginTop:10, fontSize:12, color:'#6b6860', textAlign:'center' }}>
            Click a piece to select it, then click the destination square
          </div>
        )}
      </div>

      {/* RIGHT — Tips */}
      <div style={{ width:240, flexShrink:0, background:'#1e1e1c', borderLeft:'1px solid #2e2e2a', padding:14, overflowY:'auto' }}>
        <div className="section-label">Tactical Motifs</div>
        {[
          { icon:'⚡', name:'Fork', desc:'Attack two pieces at once with one move' },
          { icon:'📌', name:'Pin', desc:'Piece is held in place to protect a more valuable piece' },
          { icon:'🎯', name:'Skewer', desc:'Force a valuable piece to move, exposing one behind' },
          { icon:'💥', name:'Discovered Attack', desc:'Moving one piece reveals an attack by another' },
          { icon:'♟', name:'Back Rank Mate', desc:'Trap the king on the back rank with no escape' },
          { icon:'🔱', name:'Double Check', desc:'Check with two pieces simultaneously' },
        ].map(m => (
          <div key={m.name} style={{ marginBottom:10, padding:'10px 12px', background:'#222220', borderRadius:8, border:'1px solid #2e2e2a' }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{m.icon} {m.name}</div>
            <div style={{ fontSize:11, color:'#6b6860', lineHeight:1.4 }}>{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
