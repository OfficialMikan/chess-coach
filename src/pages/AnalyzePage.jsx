import React, { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import EvalBar from '../components/EvalBar';
import MoveList from '../components/MoveList';
import CommentaryBox from '../components/CommentaryBox';
import { useStore } from '../store/useStore';
import { buildFenHistory, getMaterialCount, scoreToString } from '../lib/chess-utils';
import { callAI, toGeminiHistory, coachSystemPrompt } from '../lib/ai';
import * as SF from '../lib/stockfish';

export default function AnalyzePage() {
  const { geminiKey, addNotification } = useStore();

  const [username, setUsername]         = useState('');
  const [games, setGames]               = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [fenHistory, setFenHistory]     = useState([new Chess().fen()]);
  const [moves, setMoves]               = useState([]);
  const [currentIdx, setCurrentIdx]     = useState(0);
  const [flipped, setFlipped]           = useState(false);
  const [highlights, setHighlights]     = useState({});
  const [arrows, setArrows]             = useState([]);
  const [evalScore, setEvalScore]       = useState(null);
  const [evalMate, setEvalMate]         = useState(null);
  const [commentary, setCommentary]     = useState([{ type:'tip', text:"Load a chess.com game or paste a PGN to start analyzing." }]);
  const [pgnInput, setPgnInput]         = useState('');
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [chatInput, setChatInput]       = useState('');
  const [chatHistory, setChatHistory]   = useState([]);
  const [chatLoading, setChatLoading]   = useState(false);

  const addComment = useCallback((type, text) => {
    setCommentary(prev => [...prev.slice(-40), { type, text }]);
  }, []);

  /* ── Load chess.com games ── */
  const loadFromChessCom = useCallback(async () => {
    if (!username.trim()) return;
    setLoadingGames(true);
    try {
      const ar = await fetch(`https://api.chess.com/pub/player/${username.trim()}/games/archives`);
      if (!ar.ok) throw new Error('User not found');
      const { archives } = await ar.json();
      const gr = await fetch(archives[archives.length - 1]);
      const { games: list } = await gr.json();
      setGames((list || []).reverse().slice(0, 20));
      addNotification(`Loaded games for ${username}`, 'success');
    } catch (e) { addNotification('Error: ' + e.message, 'error'); }
    setLoadingGames(false);
  }, [username, addNotification]);

  const loadGame = useCallback((game) => {
    setSelectedGame(game);
    const { fens, moves: mvs } = buildFenHistory(game.pgn);
    setFenHistory(fens);
    setMoves(mvs.map(m => ({ san:m.san, from:m.from, to:m.to })));
    setCurrentIdx(fens.length - 1);
    setHighlights({}); setArrows([]);
    const isW = game.white.username.toLowerCase() === username.toLowerCase();
    setFlipped(!isW);
    addComment('info', `${game.white.username} vs ${game.black.username} · ${game.time_class} · Result: ${game.white.result}`);
  }, [username, addComment]);

  const loadPgn = useCallback(() => {
    if (!pgnInput.trim()) return;
    const { fens, moves: mvs } = buildFenHistory(pgnInput);
    if (!fens.length) { addNotification('Invalid PGN', 'error'); return; }
    setFenHistory(fens);
    setMoves(mvs.map(m => ({ san:m.san, from:m.from, to:m.to })));
    setCurrentIdx(fens.length - 1);
    setHighlights({}); setArrows([]);
    addComment('info', 'PGN loaded — navigate the moves to explore the game.');
    addNotification('PGN loaded', 'success');
  }, [pgnInput, addNotification, addComment]);

  /* ── Navigate ── */
  const goToIdx = useCallback((idx) => {
    setCurrentIdx(idx);
    if (idx > 0 && moves[idx - 1]) {
      setHighlights({ [moves[idx-1].from]:'last', [moves[idx-1].to]:'last' });
    } else setHighlights({});
    setArrows([]);
  }, [moves]);

  /* ── Stockfish analysis ── */
  const analyzePosition = useCallback(async () => {
    setAnalysisRunning(true);
    addComment('info', '🔍 Analyzing with Stockfish…');
    try {
      SF.setUnlimited();
      const result = await SF.analyzePosition(fenHistory[currentIdx], 18, 3);
      const topLines = result.lines
        .filter(l => /depth 1[5-9]|depth [2-9]\d/.test(l))
        .slice(-9);

      const newArrows = [];
      const seen = new Set();
      topLines.forEach(line => {
        const info = SF.parseInfo(line);
        if (!info.multipv || !info.pv) return;
        const lan = info.pv.split(' ')[0];
        if (!lan || lan.length < 4 || seen.has(info.multipv)) return;
        seen.add(info.multipv);
        newArrows.push({ from:lan.slice(0,2), to:lan.slice(2,4),
          color: info.multipv === 1 ? 'Green' : info.multipv === 2 ? 'Blue' : 'Red' });
        if (info.multipv === 1) {
          setEvalScore(info.mate !== undefined ? null : info.score);
          setEvalMate(info.mate);
          const chess2 = new Chess(fenHistory[currentIdx]);
          const san = lanToSan(chess2, lan);
          addComment('good', `Best move: ${san || lan} (eval ${scoreToString(info.score, info.mate)})`);
        }
      });
      setArrows(newArrows);
    } catch (e) { addComment('warning', 'Analysis error: ' + e.message); }
    setAnalysisRunning(false);
  }, [fenHistory, currentIdx, addComment]);

  function lanToSan(chess, lan) {
    try { const m = chess.move({from:lan.slice(0,2),to:lan.slice(2,4),promotion:'q'}); if(m){chess.undo();return m.san;} } catch(e){}
    return null;
  }

  /* ── Chat with Coach (Gemini) ── */
  const sendChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    if (!geminiKey) { addComment('warning', 'Add your Gemini API key (top bar) to chat with Coach Magnus!'); return; }
    const text = chatInput.trim();
    setChatInput(''); setChatLoading(true);
    const gameCtx = `Current position FEN: ${fenHistory[currentIdx]}. ` +
      `Move ${currentIdx} of ${fenHistory.length - 1}. ` +
      `Moves so far: ${moves.slice(0, currentIdx).map(m => m.san).join(' ')}`;
    try {
      const reply = await callAI(coachSystemPrompt(gameCtx), toGeminiHistory(chatHistory), text, geminiKey, 350);
      setChatHistory(h => [...h, { role:'user', content:text }, { role:'assistant', content:reply }]);
      addComment('tip', '🧑‍🏫 ' + reply);
    } catch (e) { addComment('warning', `Coach error: ${e.message}`); }
    setChatLoading(false);
  }, [chatInput, geminiKey, fenHistory, currentIdx, moves, chatHistory, addComment]);

  const displayFen = fenHistory[currentIdx] || new Chess().fen();
  const material   = getMaterialCount(displayFen);

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── LEFT ── */}
      <div style={{ width:230, flexShrink:0, background:'#1e1e1c', borderRight:'1px solid #2e2e2a', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:12, borderBottom:'1px solid #2e2e2a' }}>
          <div className="section-label">Chess.com Username</div>
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="username" onKeyDown={e => e.key === 'Enter' && loadFromChessCom()}
              style={{ fontSize:12 }}/>
            <button className="btn btn-primary btn-sm" onClick={loadFromChessCom} disabled={loadingGames}>
              {loadingGames ? '…' : 'Go'}
            </button>
          </div>
          <div className="section-label" style={{ marginBottom:6 }}>Or Paste PGN</div>
          <textarea className="input" value={pgnInput} onChange={e => setPgnInput(e.target.value)}
            placeholder="1. e4 e5 2. Nf3…" style={{ fontSize:11, minHeight:60, resize:'vertical', marginBottom:6 }}/>
          <button className="btn btn-secondary btn-sm" style={{ width:'100%' }} onClick={loadPgn}>Load PGN</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:8 }}>
          {loadingGames && <div style={{ textAlign:'center', padding:20, color:'#6b6860', fontSize:12 }}>Loading…</div>}
          {games.map((g, i) => {
            const isW  = g.white.username.toLowerCase() === username.toLowerCase();
            const myR  = isW ? g.white.result : g.black.result;
            const opp  = isW ? g.black.username : g.white.username;
            const isWin  = myR === 'win';
            const isLoss = ['checkmated','resigned','timeout','abandoned'].includes(myR);
            const rc   = isWin ? '#81b64c' : isLoss ? '#e05252' : '#d4a843';
            const rl   = isWin ? 'WIN' : isLoss ? 'LOSS' : 'DRAW';
            return (
              <div key={i} onClick={() => loadGame(g)} style={{
                padding:'9px 10px', borderRadius:8, marginBottom:5, cursor:'pointer', border:'1px solid',
                borderColor: selectedGame === g ? '#81b64c' : '#2e2e2a',
                background:  selectedGame === g ? 'rgba(129,182,76,.08)' : '#222220',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:rc }}>{rl}</span>
                  <span style={{ fontSize:10, color:'#6b6860' }}>{g.time_class?.toUpperCase()}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:600 }}>vs {opp}</div>
              </div>
            );
          })}
          {!games.length && !loadingGames && (
            <div style={{ textAlign:'center', padding:20, color:'#6b6860', fontSize:11 }}>Enter username above</div>
          )}
        </div>
      </div>

      {/* ── CENTER ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 10px', overflowY:'auto' }}>
        {selectedGame && (
          <div style={{ width:460, marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{selectedGame.white.username} vs {selectedGame.black.username}</div>
          </div>
        )}
        <div style={{ display:'flex', gap:10, alignItems:'stretch' }}>
          <EvalBar score={evalScore} mate={evalMate} height={460}/>
          <ChessBoard
            fen={displayFen}
            flipped={flipped}
            onMove={null}
            arrows={arrows}
            highlightSquares={highlights}
            interactive={false}
            boardSize={460}
          />
        </div>

        <div style={{ display:'flex', gap:6, marginTop:10, width:460 }}>
          <button className="btn btn-icon" onClick={() => goToIdx(0)}>⏮</button>
          <button className="btn btn-icon" onClick={() => goToIdx(Math.max(0, currentIdx-1))}>◀</button>
          <span style={{ fontSize:11, color:'#6b6860', padding:'0 8px', display:'flex', alignItems:'center' }}>
            {currentIdx} / {fenHistory.length - 1}
          </span>
          <button className="btn btn-icon" onClick={() => goToIdx(Math.min(fenHistory.length-1, currentIdx+1))}>▶</button>
          <button className="btn btn-icon" onClick={() => goToIdx(fenHistory.length-1)}>⏭</button>
          <div style={{ flex:1 }}/>
          <button className="btn btn-icon" onClick={() => setFlipped(f => !f)}>⇅</button>
          <button className="btn btn-primary btn-sm" onClick={analyzePosition} disabled={analysisRunning}>
            {analysisRunning ? '…' : '🔍 Analyze'}
          </button>
        </div>
        <MoveList moves={moves} currentIdx={currentIdx} onSelect={goToIdx}/>

        <div style={{ width:460, marginTop:6, display:'flex', gap:12, fontSize:11, color:'#6b6860' }}>
          <span>White ♙ {material.white}</span>
          <span>Black ♟ {material.black}</span>
          <span style={{ color: material.diff>0?'#81b64c':material.diff<0?'#e05252':'#a8a49c', fontWeight:600 }}>
            Diff: {material.diff > 0 ? '+' : ''}{material.diff}
          </span>
        </div>
      </div>

      {/* ── RIGHT — Coach ── */}
      <div style={{ width:280, flexShrink:0, background:'#1e1e1c', borderLeft:'1px solid #2e2e2a', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid #2e2e2a', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'#538a2f', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🧑‍🏫</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>Coach Magnus</div>
            <div style={{ fontSize:10, color: geminiKey ? '#81b64c' : '#d4a843' }}>
              {geminiKey ? '● Gemini AI ready' : '⚠ Add Gemini key'}
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflow:'hidden' }}>
          <CommentaryBox messages={commentary}/>
        </div>

        <div style={{ padding:'8px 10px', borderTop:'1px solid #2e2e2a', display:'flex', flexWrap:'wrap', gap:4 }}>
          {["Biggest mistake?","Best move here?","Explain opening","What's the plan?","Full analysis"].map(q => (
            <button key={q} onClick={() => setChatInput(q)}
              style={{ fontSize:10, padding:'3px 8px', borderRadius:10, border:'1px solid #3a3a37', background:'#222220', color:'#a8a49c', cursor:'pointer' }}>
              {q}
            </button>
          ))}
        </div>

        <div style={{ padding:'8px 10px', borderTop:'1px solid #2e2e2a', display:'flex', gap:6 }}>
          <input className="input" value={chatInput} onChange={e => setChatInput(e.target.value)}
            placeholder={geminiKey ? 'Ask Coach Magnus…' : 'Add Gemini key to chat'}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            style={{ fontSize:12 }}/>
          <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={!geminiKey || chatLoading}>
            {chatLoading ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
