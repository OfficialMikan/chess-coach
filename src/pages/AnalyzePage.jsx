import React, { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import EvalBar from '../components/EvalBar';
import MoveList from '../components/MoveList';
import CommentaryBox from '../components/CommentaryBox';
import { useStore } from '../store/useStore';
import { buildFenHistory, getMoveClassification, getOpeningName, scoreToString, getMaterialCount } from '../lib/chess-utils';
import * as SF from '../lib/stockfish';

export default function AnalyzePage() {
  const { apiKey, addNotification } = useStore();
  const [username, setUsername] = useState('');
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [fenHistory, setFenHistory] = useState([new Chess().fen()]);
  const [moves, setMoves] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [highlights, setHighlights] = useState({});
  const [arrows, setArrows] = useState([]);
  const [evalScore, setEvalScore] = useState(null);
  const [evalMate, setEvalMate] = useState(null);
  const [commentary, setCommentary] = useState([{ type:'tip', text:"Enter your chess.com username and load your recent games, or paste a PGN below." }]);
  const [pgnInput, setPgnInput] = useState('');
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const addComment = useCallback((type, text) => {
    setCommentary(prev => [...prev.slice(-40), { type, text }]);
  }, []);

  const loadGamesFromChessCom = useCallback(async () => {
    if (!username.trim()) return;
    setLoadingGames(true);
    try {
      const archRes = await fetch(`https://api.chess.com/pub/player/${username.trim()}/games/archives`);
      if (!archRes.ok) throw new Error('User not found');
      const { archives } = await archRes.json();
      const latest = archives[archives.length - 1];
      const gRes = await fetch(latest);
      const { games: gList } = await gRes.json();
      setGames((gList || []).reverse().slice(0, 20));
      addNotification(`Loaded ${Math.min((gList||[]).length,20)} games for ${username}`, 'success');
    } catch(e) { addNotification('Error: ' + e.message, 'error'); }
    setLoadingGames(false);
  }, [username, addNotification]);

  const loadGame = useCallback((game) => {
    setSelectedGame(game);
    const { fens, moves: mvs } = buildFenHistory(game.pgn);
    setFenHistory(fens);
    setMoves(mvs.map(m => ({ san:m.san, from:m.from, to:m.to })));
    setCurrentIdx(fens.length - 1);
    setHighlights({});
    setArrows([]);
    setCommentary([{ type:'info', text:`Game loaded: ${game.white.username} vs ${game.black.username} • ${game.time_class} • ${game.white.result}/${game.black.result}` }]);
    const isPlayerWhite = game.white.username.toLowerCase() === username.toLowerCase();
    setFlipped(!isPlayerWhite);
    addNotification('Game loaded!', 'success');
  }, [username, addNotification]);

  const loadPgn = useCallback(() => {
    if (!pgnInput.trim()) return;
    const { fens, moves: mvs } = buildFenHistory(pgnInput);
    if (!fens.length) { addNotification('Invalid PGN', 'error'); return; }
    setFenHistory(fens); setMoves(mvs.map(m=>({san:m.san,from:m.from,to:m.to})));
    setCurrentIdx(fens.length-1); setCommentary([{type:'info',text:'PGN loaded — navigate moves to analyze'}]);
    addNotification('PGN loaded', 'success');
  }, [pgnInput, addNotification]);

  const goToIdx = useCallback((idx) => {
    setCurrentIdx(idx);
    if (idx > 0 && moves[idx-1]) {
      setHighlights({ [moves[idx-1].from]:'last', [moves[idx-1].to]:'last' });
    } else setHighlights({});
  }, [moves]);

  const analyzeCurrentPosition = useCallback(async () => {
    setAnalysisRunning(true);
    addComment('info', '🔍 Analyzing position with Stockfish…');
    try {
      SF.setUnlimited();
      const result = await SF.analyzePosition(fenHistory[currentIdx], 18, 3);
      const chess = new Chess(fenHistory[currentIdx]);
      const topLines = result.lines.filter(l => l.includes('depth 18') || l.includes('depth 17')).slice(-3);
      const newArrows = [];
      topLines.forEach((line, i) => {
        const info = SF.parseInfo(line);
        if (info.pv) {
          const lan = info.pv.split(' ')[0];
          if (lan && lan.length >= 4) {
            newArrows.push({ from:lan.slice(0,2), to:lan.slice(2,4), color: i===0?'Green':i===1?'Blue':'Red' });
          }
        }
      });
      setArrows(newArrows);
      const best = SF.parseInfo(topLines[0] || '');
      setEvalScore(best.mate !== undefined ? null : best.score);
      setEvalMate(best.mate);
      addComment('good', `Best moves shown with arrows. Eval: ${scoreToString(best.score, best.mate)}`);
      if (result.bestmove && result.bestmove !== '(none)') {
        const chess2 = new Chess(fenHistory[currentIdx]);
        const san = lanToSan(chess2, result.bestmove);
        addComment('tip', `💡 Best move: ${san || result.bestmove}`);
      }
    } catch(e) { addComment('warning', 'Analysis error — ' + e.message); }
    setAnalysisRunning(false);
  }, [fenHistory, currentIdx, addComment]);

  function lanToSan(chess, lan) {
    try { const m = chess.move({from:lan.slice(0,2),to:lan.slice(2,4),promotion:'q'}); if(m){chess.undo();return m.san;} } catch(e){}
    return null;
  }

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !apiKey) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    const userMsg = { role:'user', content:text };
    const chess = new Chess(fenHistory[currentIdx]);
    const context = `You are Coach Magnus, chess AI coach. Current FEN: ${fenHistory[currentIdx]}. Moves played: ${moves.slice(0,currentIdx).map(m=>m.san).join(' ')}. Be concise (2-3 sentences), use chess notation.`;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:300,system:context,messages:[...chatHistory,userMsg]})
      });
      const d = await res.json();
      const reply = d.content?.[0]?.text || 'No response';
      setChatHistory(h => [...h, userMsg, {role:'assistant',content:reply}]);
      addComment('tip', '🧑‍🏫 ' + reply);
    } catch(e) { addComment('warning', 'Coach unavailable — check API key'); }
    setChatLoading(false);
  }, [chatInput, apiKey, fenHistory, currentIdx, moves, chatHistory, addComment]);

  const displayFen = fenHistory[currentIdx];
  const material = getMaterialCount(displayFen || new Chess().fen());
  const openingName = getOpeningName(moves.slice(0,currentIdx).map(m=>m.san));

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* LEFT — Game list */}
      <div style={{ width:230, flexShrink:0, background:'#1e1e1c', borderRight:'1px solid #2e2e2a', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:12, borderBottom:'1px solid #2e2e2a' }}>
          <div className="section-label">Chess.com Username</div>
          <div style={{ display:'flex', gap:6, marginBottom:10 }}>
            <input className="input" value={username} onChange={e=>setUsername(e.target.value)}
              placeholder="username" onKeyDown={e=>e.key==='Enter'&&loadGamesFromChessCom()} style={{ fontSize:12 }}/>
            <button className="btn btn-primary btn-sm" onClick={loadGamesFromChessCom} disabled={loadingGames}>
              {loadingGames ? '…' : 'Go'}
            </button>
          </div>
          <div className="section-label" style={{ marginBottom:6 }}>Or paste PGN</div>
          <textarea className="input" value={pgnInput} onChange={e=>setPgnInput(e.target.value)}
            placeholder="Paste PGN here…" style={{ fontSize:11, minHeight:60, resize:'vertical', marginBottom:6 }}/>
          <button className="btn btn-secondary btn-sm" style={{ width:'100%' }} onClick={loadPgn}>Load PGN</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:8 }}>
          {loadingGames && <div style={{ textAlign:'center', padding:20, color:'#6b6860', fontSize:12 }}>Loading…</div>}
          {games.map((g, i) => {
            const isW = g.white.username.toLowerCase() === username.toLowerCase();
            const myR = isW ? g.white.result : g.black.result;
            const opp = isW ? g.black.username : g.white.username;
            const resultColor = myR==='win'?'#81b64c':['checkmated','resigned','timeout','abandoned'].includes(myR)?'#e05252':'#d4a843';
            return (
              <div key={i} onClick={() => loadGame(g)}
                style={{ padding:'9px 10px', borderRadius:8, marginBottom:5, cursor:'pointer', border:'1px solid',
                  borderColor: selectedGame===g ? '#81b64c' : '#2e2e2a',
                  background: selectedGame===g ? 'rgba(129,182,76,.08)' : '#222220',
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:resultColor }}>{myR==='win'?'WIN':['checkmated','resigned','timeout','abandoned'].includes(myR)?'LOSS':'DRAW'}</span>
                  <span style={{ fontSize:10, color:'#6b6860' }}>{g.time_class?.toUpperCase()}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:600, color:'#ede9e0' }}>vs {opp}</div>
              </div>
            );
          })}
          {!games.length && !loadingGames && <div style={{ textAlign:'center', padding:20, color:'#6b6860', fontSize:11 }}>Enter username above</div>}
        </div>
      </div>

      {/* CENTER — Board */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 10px', overflowY:'auto', gap:0 }}>
        {selectedGame && (
          <div style={{ width:460, marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{selectedGame.white.username} vs {selectedGame.black.username}</div>
            <div style={{ display:'flex', gap:6 }}>
              <span style={{ fontSize:11, background:'rgba(129,182,76,.12)', border:'1px solid rgba(129,182,76,.2)', color:'#81b64c', padding:'2px 8px', borderRadius:4 }}>{openingName}</span>
            </div>
          </div>
        )}
        <div style={{ display:'flex', gap:10, alignItems:'stretch' }}>
          <EvalBar score={evalScore} mate={evalMate} height={460}/>
          <ChessBoard fen={displayFen || new Chess().fen()} flipped={flipped} onMove={null} arrows={arrows} highlightSquares={highlights} interactive={false} boardSize={460}/>
        </div>

        {/* Controls */}
        <div style={{ display:'flex', gap:6, marginTop:10, width:460 }}>
          <button className="btn btn-icon" onClick={()=>goToIdx(0)}>⏮</button>
          <button className="btn btn-icon" onClick={()=>goToIdx(Math.max(0,currentIdx-1))}>◀</button>
          <span style={{ fontSize:11, color:'#6b6860', padding:'0 8px', display:'flex', alignItems:'center' }}>{currentIdx}/{fenHistory.length-1}</span>
          <button className="btn btn-icon" onClick={()=>goToIdx(Math.min(fenHistory.length-1,currentIdx+1))}>▶</button>
          <button className="btn btn-icon" onClick={()=>goToIdx(fenHistory.length-1)}>⏭</button>
          <div style={{flex:1}}/>
          <button className="btn btn-icon" onClick={()=>setFlipped(f=>!f)}>⇅</button>
          <button className="btn btn-primary btn-sm" onClick={analyzeCurrentPosition} disabled={analysisRunning}>
            {analysisRunning ? '…' : '🔍 Analyze'}
          </button>
        </div>
        <MoveList moves={moves} currentIdx={currentIdx} onSelect={goToIdx}/>

        {/* Material diff */}
        <div style={{ width:460, marginTop:6, display:'flex', gap:8, fontSize:11, color:'#6b6860' }}>
          <span>White: {material.white}pts</span>
          <span>Black: {material.black}pts</span>
          <span style={{ color: material.diff>0?'#81b64c':material.diff<0?'#e05252':'#a8a49c' }}>Diff: {material.diff>0?'+':''}{material.diff}</span>
        </div>
      </div>

      {/* RIGHT — Coach chat */}
      <div style={{ width:280, flexShrink:0, background:'#1e1e1c', borderLeft:'1px solid #2e2e2a', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid #2e2e2a', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'#538a2f', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🧑‍🏫</div>
          <div style={{ fontSize:13, fontWeight:700 }}>Coach Magnus</div>
          {!apiKey && <span style={{ fontSize:10, color:'#6b6860', marginLeft:'auto' }}>Add API key</span>}
        </div>
        <div style={{ flex:1, overflow:'hidden' }}>
          <CommentaryBox messages={commentary}/>
        </div>
        {/* Quick prompts */}
        <div style={{ padding:'8px 10px', borderTop:'1px solid #2e2e2a', display:'flex', flexWrap:'wrap', gap:4 }}>
          {["Biggest mistake?","Best move here?","Explain opening","Improvement tips"].map(q=>(
            <button key={q} onClick={()=>{setChatInput(q);}} style={{ fontSize:10, padding:'3px 8px', borderRadius:10, border:'1px solid #3a3a37', background:'#222220', color:'#a8a49c', cursor:'pointer' }}>{q}</button>
          ))}
        </div>
        <div style={{ padding:'8px 10px', borderTop:'1px solid #2e2e2a', display:'flex', gap:6 }}>
          <input className="input" value={chatInput} onChange={e=>setChatInput(e.target.value)}
            placeholder={apiKey ? "Ask Coach Magnus…" : "Add API key to chat"}
            disabled={!apiKey} style={{ fontSize:12 }}
            onKeyDown={e=>e.key==='Enter'&&sendChat()}/>
          <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={!apiKey||chatLoading}>
            {chatLoading ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
