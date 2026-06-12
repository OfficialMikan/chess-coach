import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import EvalBar from '../components/EvalBar';
import MoveList from '../components/MoveList';
import CommentaryBox from '../components/CommentaryBox';
import { useStore } from '../store/useStore';
import { saveGame } from '../lib/firebase';
import * as SF from '../lib/stockfish';
import { quickComment, callAI, toGeminiHistory, coachSystemPrompt } from '../lib/ai';
import { getMoveClassification, getOpeningName, getMaterialCount, scoreToString, lanToSan } from '../lib/chess-utils';

export default function PlayPage() {
  const { trainerSettings, setTrainerSettings, user, geminiKey, addNotification } = useStore();

  const [chess]        = useState(() => new Chess());
  const [fen, setFen]  = useState(chess.fen());
  const [moves, setMoves]           = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fenHistory, setFenHistory] = useState([chess.fen()]);
  const [commentary, setCommentary] = useState([
    { type:'tip', text:"Welcome! Set the engine strength on the left, then click New Game. I'll coach every move!" }
  ]);
  const [gameStatus, setGameStatus] = useState('idle');
  const [arrows, setArrows]         = useState([]);
  const [highlights, setHighlights] = useState({});
  const [evalScore, setEvalScore]   = useState(null);
  const [evalMate, setEvalMate]     = useState(null);
  const [thinking, setThinking]     = useState(false);
  const [playerColor, setPlayerColor] = useState('white');
  const [showNewGame, setShowNewGame] = useState(false);
  const [gameOver, setGameOver]     = useState(null);
  const [prevScore, setPrevScore]   = useState(0);
  const [chatInput, setChatInput]   = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const addComment = useCallback((type, text) => {
    setCommentary(prev => [...prev.slice(-40), { type, text }]);
  }, []);

  /* ── Stockfish analysis + commentary after each player move ── */
  const analyzeAndComment = useCallback(async (move, fenBefore) => {
    if (!trainerSettings.commentary) return;
    try {
      SF.setUnlimited();
      const result = await SF.analyzePosition(fenBefore, 10, 1);
      const infos = result.lines.filter(l => l.includes('multipv 1'));
      if (!infos.length) return;
      const parsed = SF.parseInfo(infos[infos.length - 1]);
      const newScore = parsed.score ?? 0;
      const turn = chess.turn(); // whose turn it is AFTER the move
      const delta = turn === 'b'
        ? newScore - prevScore      // white just moved, positive = white improved
        : prevScore - newScore;     // black just moved
      const cls = getMoveClassification(delta);
      setPrevScore(newScore);
      setEvalScore(parsed.mate !== undefined ? null : newScore);
      setEvalMate(parsed.mate);

      /* Classification comment */
      if (Math.abs(delta) > 0.05) {
        addComment(
          cls.class === 'blunder' || cls.class === 'mistake' ? 'danger'
            : cls.class === 'inaccuracy' ? 'warning' : 'good',
          `${cls.emoji} ${move.san} — ${cls.label} (eval ${scoreToString(newScore)})`
        );
      } else {
        addComment('info', `${move.san} — ${cls.label}`);
      }

      /* Special move comments */
      if (move.captured)           addComment('info', `Captured the ${move.captured.toUpperCase()}. Material has shifted!`);
      if (move.flags?.includes('k')) addComment('good', 'Castled kingside ♜ — king safety improved!');
      if (move.flags?.includes('q')) addComment('good', 'Castled queenside — watch the open files!');
      if (chess.inCheck())          addComment('warning', `Check! ${turn === 'w' ? 'White' : 'Black'} must respond.`);

      /* AI deep comment on blunders/mistakes */
      if ((cls.class === 'blunder' || cls.class === 'mistake') && geminiKey) {
        const prompt =
          `Chess coach (2 sentences max): The player just played ${move.san} — a ${cls.label} ` +
          `(eval drop ${Math.abs(delta).toFixed(1)} pawns). ` +
          `FEN before move: ${fenBefore}. ` +
          `Briefly explain WHY it's bad and suggest a better plan. Be specific, use notation.`;
        quickComment(prompt, geminiKey, 100)
          .then(txt => addComment('tip', '🧑‍🏫 ' + txt))
          .catch(() => {});
      }
    } catch (e) { console.error('analysis error', e); }
  }, [prevScore, trainerSettings.commentary, chess, addComment, geminiKey]);

  /* ── Engine reply ── */
  const makeEngineMove = useCallback(async () => {
    if (gameStatus !== 'playing') return;
    setThinking(true);
    try {
      const { stockfishLevel, stockfishElo, useElo } = trainerSettings;
      SF.sendCommand('ucinewgame');
      if (useElo) SF.setElo(stockfishElo);
      else SF.setSkillLevel(stockfishLevel);
      const movetime = useElo
        ? Math.max(200, Math.min(2000, stockfishElo / 2))
        : stockfishLevel * 100 + 100;
      const { best } = await SF.getBestMove(chess.fen(), movetime);
      if (!best || best === '(none)') { setThinking(false); return; }
      const result = chess.move({ from: best.slice(0,2), to: best.slice(2,4), promotion: best[4] || 'q' });
      if (!result) { setThinking(false); return; }
      const newFen = chess.fen();
      setFen(newFen);
      setFenHistory(h => [...h, newFen]);
      setCurrentIdx(i => i + 1);
      setMoves(m => [...m, { san: result.san, from: result.from, to: result.to }]);
      setHighlights({ [result.from]: 'last', [result.to]: 'last' });
      if (chess.isGameOver()) handleGameEnd();
    } catch (e) { console.error(e); }
    setThinking(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, trainerSettings, gameStatus]);

  /* ── Player move ── */
  const handlePlayerMove = useCallback(async (move) => {
    if (gameStatus !== 'playing') return;
    const fenBefore = fenHistory[fenHistory.length - 1];
    const newFen = chess.fen();
    const newHistory = [...fenHistory, newFen];
    setFen(newFen);
    setFenHistory(newHistory);
    setCurrentIdx(newHistory.length - 1);
    setMoves(m => [...m, { san: move.san, from: move.from, to: move.to }]);
    setHighlights({ [move.from]: 'last', [move.to]: 'last' });
    setArrows([]);
    if (chess.isGameOver()) { handleGameEnd(); return; }
    analyzeAndComment(move, fenBefore);
    setTimeout(makeEngineMove, 350);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, gameStatus, fenHistory, analyzeAndComment, makeEngineMove]);

  /* ── Game end ── */
  const handleGameEnd = useCallback(() => {
    let result = chess.isCheckmate()
      ? (chess.turn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!')
      : chess.isStalemate() ? 'Draw — stalemate!'
      : chess.isDraw()      ? 'Draw!'
      : 'Game over';
    setGameStatus('ended');
    setGameOver(result);
    addComment('brilliant', '🏁 ' + result);
    if (user) {
      saveGame(user.uid, {
        pgn: chess.pgn(), result,
        date: new Date().toISOString(),
        white: playerColor === 'white' ? 'You' : `Stockfish (${trainerSettings.stockfishElo})`,
        black: playerColor === 'black' ? 'You' : `Stockfish (${trainerSettings.stockfishElo})`,
        type: 'vs-engine', elo: trainerSettings.stockfishElo,
      }).catch(() => {});
      addNotification('Game saved to library ✓', 'success');
    }
  }, [chess, playerColor, trainerSettings, user, addComment, addNotification]);

  /* ── New game ── */
  const startNewGame = useCallback(() => {
    const color = playerColor === 'random'
      ? (Math.random() < 0.5 ? 'white' : 'black')
      : playerColor;
    chess.reset();
    const initFen = chess.fen();
    setFen(initFen);
    setFenHistory([initFen]);
    setCurrentIdx(0);
    setMoves([]);
    setCommentary([{ type:'tip', text:`New game started! You play as ${color}. ${color === 'black' ? 'Stockfish will open…' : 'Make your first move!'}` }]);
    setArrows([]); setHighlights({});
    setGameStatus('playing'); setGameOver(null);
    setEvalScore(null); setEvalMate(null); setPrevScore(0);
    setChatHistory([]);
    setShowNewGame(false);
    if (color === 'black') setTimeout(makeEngineMove, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, playerColor, makeEngineMove]);

  /* ── Hint ── */
  const showHint = useCallback(async () => {
    if (gameStatus !== 'playing') return;
    addComment('tip', '🔍 Finding best move…');
    SF.setUnlimited();
    const { best } = await SF.getBestMove(chess.fen(), 2000);
    if (!best) return;
    const san = lanToSan(chess, best);
    setArrows([{ from: best.slice(0,2), to: best.slice(2,4), color:'Green' }]);
    addComment('tip', `💡 Best move: ${san || best} — think about why before playing it!`);
    if (trainerSettings.useElo) SF.setElo(trainerSettings.stockfishElo);
    else SF.setSkillLevel(trainerSettings.stockfishLevel);
  }, [chess, gameStatus, trainerSettings, addComment]);

  /* ── Chat with Coach ── */
  const sendChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    if (!geminiKey) { addComment('warning', 'Add a Gemini API key (top bar) to chat with Coach Magnus!'); return; }
    const text = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    const ctx = `Current game — you play as ${playerColor}. ` +
      `Position FEN: ${fenHistory[currentIdx]}. ` +
      `Moves so far: ${moves.slice(0, currentIdx).map(m => m.san).join(' ')}. ` +
      `Engine ELO setting: ${trainerSettings.stockfishElo}.`;
    try {
      const reply = await callAI(coachSystemPrompt(ctx), toGeminiHistory(chatHistory), text, geminiKey, 300);
      setChatHistory(h => [...h, { role:'user', content:text }, { role:'assistant', content:reply }]);
      addComment('tip', `🧑‍🏫 ${reply}`);
    } catch (e) {
      addComment('warning', `Coach error: ${e.message}`);
    }
    setChatLoading(false);
  }, [chatInput, geminiKey, playerColor, fenHistory, currentIdx, moves, trainerSettings, chatHistory, addComment]);

  const isPlayerTurn = () => {
    const t = chess.turn();
    return (playerColor === 'white' && t === 'w') || (playerColor === 'black' && t === 'b');
  };

  const goToMove = (idx) => { setCurrentIdx(idx); };
  const displayFen = fenHistory[currentIdx] || fen;
  const material   = getMaterialCount(displayFen);
  const opening    = getOpeningName(moves.map(m => m.san));

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ width:220, flexShrink:0, background:'#1e1e1c', borderRight:'1px solid #2e2e2a',
                    display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:14, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>

          {/* Game controls */}
          <div>
            <div className="section-label">Game</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <button className="btn btn-primary" style={{ width:'100%' }} onClick={() => setShowNewGame(true)}>
                ▶ New Game
              </button>
              {gameStatus === 'playing' && <>
                <button className="btn btn-secondary btn-sm" style={{ width:'100%' }} onClick={handleGameEnd}>
                  ⚑ Resign
                </button>
                <button className="btn btn-secondary btn-sm" style={{ width:'100%' }} onClick={showHint}>
                  💡 Hint
                </button>
              </>}
            </div>
          </div>

          {/* Engine strength */}
          <div>
            <div className="section-label">Engine Strength</div>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              {['ELO','Level'].map(m => (
                <button key={m} onClick={() => setTrainerSettings({ useElo: m === 'ELO' })} style={{
                  flex:1, padding:'5px 0', borderRadius:6, fontSize:11, fontWeight:700, border:'none', cursor:'pointer',
                  background: (m === 'ELO') === trainerSettings.useElo ? '#81b64c' : '#2a2a27',
                  color:      (m === 'ELO') === trainerSettings.useElo ? '#fff'    : '#6b6860',
                }}>{m}</button>
              ))}
            </div>

            {trainerSettings.useElo ? (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:11, color:'#a8a49c' }}>Target ELO</span>
                  <span style={{ fontSize:15, fontWeight:700, color:'#d4a843', fontFamily:"'Playfair Display',serif" }}>
                    {trainerSettings.stockfishElo}
                  </span>
                </div>
                <input type="range" min={400} max={2800} step={50}
                  value={trainerSettings.stockfishElo}
                  onChange={e => setTrainerSettings({ stockfishElo: +e.target.value })}
                  style={{ width:'100%', accentColor:'#81b64c', marginBottom:8 }}/>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {[400,800,1200,1600,2000,2400].map(e => (
                    <button key={e} onClick={() => setTrainerSettings({ stockfishElo: e })} style={{
                      flex:'1 0 auto', minWidth:40, padding:'3px 0', borderRadius:5,
                      fontSize:10, fontWeight:600, border:'1px solid', cursor:'pointer',
                      borderColor: trainerSettings.stockfishElo === e ? '#81b64c' : '#3a3a37',
                      background:  trainerSettings.stockfishElo === e ? 'rgba(129,182,76,.15)' : '#222220',
                      color:       trainerSettings.stockfishElo === e ? '#81b64c' : '#6b6860',
                    }}>{e}</button>
                  ))}
                </div>
                <div style={{ marginTop:8, fontSize:11, color:'#6b6860', textAlign:'center' }}>
                  {trainerSettings.stockfishElo < 800  ? '🟢 Beginner'
                  : trainerSettings.stockfishElo < 1200 ? '🟡 Intermediate'
                  : trainerSettings.stockfishElo < 1600 ? '🟠 Advanced'
                  : trainerSettings.stockfishElo < 2200 ? '🔴 Expert'
                  : '⚡ Master+'}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:11, color:'#a8a49c' }}>Skill Level</span>
                  <span style={{ fontSize:15, fontWeight:700, color:'#d4a843' }}>{trainerSettings.stockfishLevel} / 20</span>
                </div>
                <input type="range" min={1} max={20} value={trainerSettings.stockfishLevel}
                  onChange={e => setTrainerSettings({ stockfishLevel: +e.target.value })}
                  style={{ width:'100%', accentColor:'#81b64c' }}/>
              </div>
            )}
          </div>

          {/* Play as */}
          <div>
            <div className="section-label">Play As</div>
            <div style={{ display:'flex', gap:6 }}>
              {['white','black','random'].map(c => (
                <button key={c} onClick={() => setPlayerColor(c)} style={{
                  flex:1, padding:'6px 0', borderRadius:6, fontSize:14, fontWeight:600, border:'1px solid', cursor:'pointer',
                  borderColor: playerColor === c ? '#81b64c' : '#3a3a37',
                  background:  playerColor === c ? 'rgba(129,182,76,.15)' : '#222220',
                  color:       playerColor === c ? '#81b64c' : '#6b6860',
                }}>
                  {c === 'white' ? '☀' : c === 'black' ? '🌙' : '🎲'}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div>
            <div className="section-label">Coach Options</div>
            {[
              { key:'commentary', label:'Live Commentary' },
              { key:'showHints',  label:'Show Hints'      },
              { key:'showArrows', label:'Move Arrows'     },
            ].map(o => (
              <label key={o.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', cursor:'pointer' }}>
                <span style={{ fontSize:12, color:'#a8a49c' }}>{o.label}</span>
                <div onClick={() => setTrainerSettings({ [o.key]: !trainerSettings[o.key] })}
                  style={{ width:32, height:18, borderRadius:9, position:'relative', transition:'.2s', cursor:'pointer',
                           background: trainerSettings[o.key] ? '#81b64c' : '#3a3a37' }}>
                  <div style={{ position:'absolute', top:2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'.2s',
                                left: trainerSettings[o.key] ? 16 : 2 }}/>
                </div>
              </label>
            ))}
          </div>

          {/* Live stats */}
          {gameStatus !== 'idle' && (
            <div>
              <div className="section-label">Live Stats</div>
              <div style={{ fontSize:12, color:'#a8a49c', display:'flex', flexDirection:'column', gap:4 }}>
                {[
                  ['Opening', opening,  '#ede9e0'],
                  ['Eval',    scoreToString(evalScore, evalMate), '#d4a843'],
                  ['Material', (material.diff > 0 ? '+' : '') + material.diff,
                               material.diff > 0 ? '#81b64c' : material.diff < 0 ? '#e05252' : '#a8a49c'],
                  ['Moves',   moves.length, '#ede9e0'],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span>{l}</span>
                    <span style={{ color:c, fontWeight:600, fontSize:11 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER BOARD ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                    padding:'14px 12px', overflowY:'auto', gap:0 }}>
        <PlayerBar
          name={playerColor === 'white' ? `Stockfish (${trainerSettings.stockfishElo})` : 'You'}
          isEngine={playerColor === 'white'}
          thinking={thinking && chess.turn() === (playerColor === 'white' ? 'w' : 'b')}
          color={playerColor === 'white' ? 'black' : 'white'}
          material={playerColor === 'white' ? material.black : material.white}
        />

        <div style={{ display:'flex', gap:10, alignItems:'stretch', marginTop:8 }}>
          <EvalBar score={evalScore} mate={evalMate} height={460}/>
          <ChessBoard
            fen={displayFen}
            flipped={playerColor === 'black'}
            onMove={handlePlayerMove}
            arrows={arrows}
            highlightSquares={highlights}
            interactive={isPlayerTurn() && gameStatus === 'playing' && currentIdx === fenHistory.length - 1}
            boardSize={460}
          />
        </div>

        <PlayerBar
          name={playerColor === 'white' ? 'You' : `Stockfish (${trainerSettings.stockfishElo})`}
          isEngine={playerColor === 'black'}
          thinking={thinking && chess.turn() === (playerColor === 'black' ? 'w' : 'b')}
          color={playerColor}
          material={playerColor === 'white' ? material.white : material.black}
        />

        {/* Board controls */}
        <div style={{ display:'flex', gap:6, marginTop:10, alignItems:'center', width:460 }}>
          <button className="btn btn-icon" onClick={() => goToMove(0)}>⏮</button>
          <button className="btn btn-icon" onClick={() => goToMove(Math.max(0, currentIdx - 1))}>◀</button>
          <span style={{ fontSize:11, color:'#6b6860', padding:'0 6px', whiteSpace:'nowrap' }}>
            {currentIdx} / {fenHistory.length - 1}
          </span>
          <button className="btn btn-icon" onClick={() => goToMove(Math.min(fenHistory.length - 1, currentIdx + 1))}>▶</button>
          <button className="btn btn-icon" onClick={() => goToMove(fenHistory.length - 1)}>⏭</button>
          <div style={{ flex:1 }}/>
          <button className="btn btn-icon" title="Flip" onClick={() => setPlayerColor(c => c === 'white' ? 'black' : 'white')}>⇅</button>
        </div>
        <MoveList moves={moves} currentIdx={currentIdx} onSelect={goToMove}/>

        {/* Game-over banner */}
        {gameOver && (
          <div style={{ width:460, marginTop:12, background:'rgba(129,182,76,.1)', border:'1px solid rgba(129,182,76,.3)',
                        borderRadius:10, padding:'14px 18px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>🏁 {gameOver}</div>
            <button className="btn btn-primary" onClick={() => setShowNewGame(true)}>Play Again</button>
          </div>
        )}
      </div>

      {/* ── RIGHT — Coach chat ── */}
      <div style={{ width:280, flexShrink:0, background:'#1e1e1c', borderLeft:'1px solid #2e2e2a', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'10px 12px', borderBottom:'1px solid #2e2e2a', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:'#538a2f', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🧑‍🏫</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>Coach Magnus</div>
            <div style={{ fontSize:10, color: geminiKey ? '#81b64c' : '#d4a843', display:'flex', alignItems:'center', gap:4 }}>
              {geminiKey
                ? <><div style={{ width:5, height:5, borderRadius:'50%', background:'#81b64c', animation:'pulse 2s infinite' }}/> Powered by Gemini</>
                : '⚠ Add Gemini key for AI chat'}
            </div>
          </div>
          {thinking && <div style={{ marginLeft:'auto', width:14, height:14, border:'2px solid #3a3a37', borderTop:'2px solid #81b64c', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>}
        </div>

        {/* Commentary feed */}
        <div style={{ flex:1, overflow:'hidden' }}>
          <CommentaryBox messages={commentary}/>
        </div>

        {/* Quick prompts */}
        <div style={{ padding:'8px 10px', borderTop:'1px solid #2e2e2a', display:'flex', flexWrap:'wrap', gap:4 }}>
          {["What's my best move?","Why was that bad?","What's the plan?","Opening tips","How to improve?"].map(q => (
            <button key={q} onClick={() => setChatInput(q)}
              style={{ fontSize:10, padding:'3px 8px', borderRadius:10, border:'1px solid #3a3a37',
                       background:'#222220', color:'#a8a49c', cursor:'pointer' }}>{q}</button>
          ))}
        </div>

        {/* Chat input */}
        <div style={{ padding:'8px 10px', borderTop:'1px solid #2e2e2a', display:'flex', gap:6 }}>
          <input className="input" value={chatInput} onChange={e => setChatInput(e.target.value)}
            placeholder={geminiKey ? 'Ask Coach Magnus…' : 'Add Gemini key to chat'}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            style={{ fontSize:12 }}/>
          <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={chatLoading || !geminiKey}>
            {chatLoading ? '…' : '→'}
          </button>
        </div>
      </div>

      {/* ── New Game Modal ── */}
      {showNewGame && (
        <div onClick={() => setShowNewGame(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#222220', border:'1px solid #383834', borderRadius:16, padding:28, width:360, maxWidth:'95vw' }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, marginBottom:16 }}>New Game</h2>
            <div className="section-label">Play As</div>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {['white','black','random'].map(c => (
                <button key={c} onClick={() => setPlayerColor(c)} style={{
                  flex:1, padding:'10px 0', borderRadius:8, fontSize:13, fontWeight:600, border:'2px solid', cursor:'pointer',
                  borderColor: playerColor === c ? '#81b64c' : '#3a3a37',
                  background:  playerColor === c ? 'rgba(129,182,76,.15)' : '#222220',
                  color:       playerColor === c ? '#81b64c' : '#6b6860',
                }}>
                  {c === 'white' ? '☀ White' : c === 'black' ? '🌙 Black' : '🎲 Random'}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" style={{ width:'100%' }} onClick={startNewGame}>
              ▶ Start Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerBar({ name, isEngine, thinking, color, material }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:460, padding:'6px 2px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{
          width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
          background: color === 'white' ? '#ede9e0' : '#2a2a27',
          color:       color === 'white' ? '#1a1a18' : '#ede9e0',
          border:'1px solid #464642',
        }}>
          {isEngine ? '🤖' : '👤'}
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:600 }}>{name}</div>
          {thinking && <div style={{ fontSize:10, color:'#d4a843' }}>thinking…</div>}
        </div>
      </div>
      <div style={{ fontSize:11, color:'#6b6860' }}>♙ {material}</div>
    </div>
  );
}
