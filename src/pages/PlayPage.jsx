import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import EvalBar from '../components/EvalBar';
import MoveList from '../components/MoveList';
import CommentaryBox from '../components/CommentaryBox';
import { useStore } from '../store/useStore';
import { saveGame } from '../lib/firebase';
import * as SF from '../lib/stockfish';
import { getMoveClassification, getOpeningName, getMaterialCount, scoreToString, lanToSan } from '../lib/chess-utils';

const ELO_MARKS = [400,600,800,1000,1200,1400,1600,1800,2000,2200,2500,2800];

export default function PlayPage() {
  const { trainerSettings, setTrainerSettings, user, apiKey, addNotification } = useStore();
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [moves, setMoves] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fenHistory, setFenHistory] = useState([chess.fen()]);
  const [commentary, setCommentary] = useState([{ type:'tip', text:"Welcome! Set your opponent strength on the left, then click 'New Game' to start. I'll coach you every move!" }]);
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | ended
  const [arrows, setArrows] = useState([]);
  const [highlights, setHighlights] = useState({});
  const [evalScore, setEvalScore] = useState(null);
  const [evalMate, setEvalMate] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [bestMoveArrow, setBestMoveArrow] = useState(null);
  const [playerColor, setPlayerColor] = useState('white');
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [prevScore, setPrevScore] = useState(0);
  const boardRef = useRef(null);

  const isPlayerTurn = useCallback(() => {
    const turn = chess.turn();
    return (playerColor === 'white' && turn === 'w') || (playerColor === 'black' && turn === 'b');
  }, [chess, playerColor]);

  const addComment = useCallback((type, text) => {
    setCommentary(prev => [...prev.slice(-30), { type, text }]);
  }, []);

  const analyzeAndComment = useCallback(async (move, fenBefore) => {
    if (!trainerSettings.commentary) return;
    try {
      const result = await SF.analyzePosition(fenBefore, 12, 1);
      const infos = result.lines.filter(l => l.includes('multipv 1'));
      if (!infos.length) return;
      const parsed = SF.parseInfo(infos[infos.length-1]);
      const newScore = parsed.score ?? 0;
      const delta = chess.turn() === 'w' ? newScore - prevScore : prevScore - newScore;
      const cls = getMoveClassification(delta);
      setPrevScore(newScore);
      setEvalScore(parsed.mate !== undefined ? null : newScore);
      setEvalMate(parsed.mate);

      let msgs = [];
      // Classification
      if (Math.abs(delta) > 0.1) {
        msgs.push({ type: cls.class === 'blunder' || cls.class === 'mistake' ? 'danger' : cls.class === 'inaccuracy' ? 'warning' : 'good',
          text: `${cls.emoji} ${move.san} — ${cls.label}! (${scoreToString(newScore)})` });
      }

      // Move-specific commentary
      if (move.captured) msgs.push({ type:'info', text:`Captured ${move.captured === 'p' ? 'pawn' : move.captured.toUpperCase()}. Material shift!` });
      if (move.flags?.includes('k')) msgs.push({ type:'good', text:'Castled kingside — king safety secured ✓' });
      if (move.flags?.includes('q')) msgs.push({ type:'good', text:'Castled queenside — watch out for open files!' });
      if (chess.in_check()) msgs.push({ type:'warning', text:`Check! ${chess.turn() === 'w' ? 'White' : 'Black'} king must respond.` });
      if (chess.in_checkmate()) msgs.push({ type:'brilliant', text:'Checkmate! Game over.' });
      
      // Blunder follow-up
      if (cls.class === 'blunder' && apiKey) {
        const prompt = `Chess coach feedback (1-2 sentences, direct): Player played ${move.san}. It's a blunder (eval drop ${Math.abs(delta).toFixed(1)}). What should they have done instead? Position FEN: ${fenBefore}`;
        fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
          body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:120, messages:[{role:'user',content:prompt}] })
        }).then(r=>r.json()).then(d=>{
          const txt = d.content?.[0]?.text;
          if(txt) addComment('tip', '🧑‍🏫 ' + txt);
        }).catch(()=>{});
      }

      msgs.forEach(m => addComment(m.type, m.text));
    } catch(e) {}
  }, [prevScore, trainerSettings.commentary, chess, addComment, apiKey]);

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
        : stockfishLevel * 120 + 100;
      const { best } = await SF.getBestMove(chess.fen(), movetime);
      if (!best || best === '(none)') { setThinking(false); return; }
      const from = best.slice(0,2), to = best.slice(2,4), promo = best[4];
      const result = chess.move({ from, to, promotion: promo || 'q' });
      if (!result) { setThinking(false); return; }
      const newFen = chess.fen();
      setFen(newFen);
      setFenHistory(h => [...h, newFen]);
      setCurrentIdx(i => i + 1);
      setMoves(m => [...m, { san: result.san, from, to }]);
      setHighlights({ [from]:'last', [to]:'last' });
      // Check game end
      if (chess.game_over()) handleGameEnd();
    } catch(e) { console.error(e); }
    setThinking(false);
  }, [chess, trainerSettings, gameStatus]);

  const handlePlayerMove = useCallback(async (move) => {
    if (!isPlayerTurn() || gameStatus !== 'playing') return;
    const fenBefore = chess.fen();
    const newFen = chess.fen();
    setFen(newFen);
    const newHistory = [...fenHistory, newFen];
    setFenHistory(newHistory);
    setCurrentIdx(newHistory.length - 1);
    setMoves(m => [...m, { san: move.san, from: move.from, to: move.to }]);
    setHighlights({ [move.from]:'last', [move.to]:'last' });
    setBestMoveArrow(null);
    setArrows([]);

    // Check game end
    if (chess.game_over()) { handleGameEnd(); return; }

    // Analyze player's move
    analyzeAndComment(move, fenBefore);

    // Engine responds
    setTimeout(makeEngineMove, 300);
  }, [chess, isPlayerTurn, gameStatus, fenHistory, analyzeAndComment, makeEngineMove]);

  const handleGameEnd = useCallback(() => {
    let result = '';
    if (chess.in_checkmate()) result = chess.turn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
    else if (chess.in_stalemate()) result = 'Stalemate — Draw!';
    else if (chess.in_draw()) result = 'Draw!';
    else result = 'Game over';
    setGameStatus('ended');
    setGameOver(result);
    addComment('brilliant', '🏁 ' + result);
    
    // Save game if logged in
    if (user) {
      const pgn = chess.pgn();
      saveGame(user.uid, {
        pgn, result, date: new Date().toISOString(),
        white: playerColor === 'white' ? 'You' : `Stockfish (${trainerSettings.stockfishElo})`,
        black: playerColor === 'black' ? 'You' : `Stockfish (${trainerSettings.stockfishElo})`,
        type: 'vs-engine',
        elo: trainerSettings.stockfishElo,
      }).catch(()=>{});
      addNotification('Game saved to your library', 'success');
    }
  }, [chess, playerColor, trainerSettings, user, addComment, addNotification]);

  const startNewGame = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setFenHistory([chess.fen()]);
    setCurrentIdx(0);
    setMoves([]);
    setCommentary([{ type:'tip', text:`Game started! You're playing as ${playerColor}. ${playerColor === 'black' ? "Stockfish will move first..." : "Make your first move!"}` }]);
    setArrows([]); setBestMoveArrow(null); setHighlights({});
    setGameStatus('playing'); setGameOver(null);
    setEvalScore(null); setEvalMate(null); setPrevScore(0);
    setShowNewGameModal(false);

    if (playerColor === 'black') {
      setTimeout(makeEngineMove, 500);
    }
  }, [chess, playerColor, makeEngineMove]);

  const showHint = useCallback(async () => {
    if (!isPlayerTurn() || gameStatus !== 'playing') return;
    addComment('tip', '🔍 Calculating best move...');
    SF.setUnlimited();
    const { best } = await SF.getBestMove(chess.fen(), 2000);
    if (!best) return;
    const san = lanToSan(chess, best);
    const from = best.slice(0,2), to = best.slice(2,4);
    setArrows([{ from, to, color:'Green' }]);
    addComment('tip', `💡 Best move suggestion: ${san || best} — try to understand why!`);
    // Restore engine settings
    if (trainerSettings.useElo) SF.setElo(trainerSettings.stockfishElo);
    else SF.setSkillLevel(trainerSettings.stockfishLevel);
  }, [chess, isPlayerTurn, gameStatus, trainerSettings, addComment]);

  const goToMove = useCallback((idx) => {
    setCurrentIdx(idx);
    if (fenHistory[idx]) {
      // Display only — don't change chess state
    }
  }, [fenHistory]);

  const displayFen = fenHistory[currentIdx] || fen;
  const material = getMaterialCount(displayFen);
  const openingName = getOpeningName(moves.map(m=>m.san));

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* LEFT PANEL — Settings */}
      <div style={{ width:220, flexShrink:0, background:'#1e1e1c', borderRight:'1px solid #2e2e2a', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:14, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
          
          {/* Game controls */}
          <div>
            <div className="section-label">Game</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <button className="btn btn-primary" style={{ width:'100%' }} onClick={() => setShowNewGameModal(true)}>
                ▶ New Game
              </button>
              {gameStatus === 'playing' && (
                <>
                  <button className="btn btn-secondary btn-sm" style={{ width:'100%' }} onClick={() => { chess.move({ from:'e2',to:'e2'}); handleGameEnd(); }}>
                    ⚑ Resign
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ width:'100%' }} onClick={showHint}>
                    💡 Hint
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Engine strength */}
          <div>
            <div className="section-label">Engine Strength</div>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              {['ELO','Level'].map(m => (
                <button key={m} onClick={() => setTrainerSettings({ useElo: m==='ELO' })}
                  style={{ flex:1, padding:'5px 0', borderRadius:6, fontSize:11, fontWeight:700, border:'none', cursor:'pointer',
                    background: (m==='ELO') === trainerSettings.useElo ? '#81b64c' : '#2a2a27',
                    color: (m==='ELO') === trainerSettings.useElo ? '#fff' : '#6b6860',
                  }}>{m}</button>
              ))}
            </div>

            {trainerSettings.useElo ? (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:11, color:'#a8a49c' }}>Target ELO</span>
                  <span style={{ fontSize:14, fontWeight:700, color:'#d4a843', fontFamily:"'Playfair Display',serif" }}>{trainerSettings.stockfishElo}</span>
                </div>
                <input type="range" min={400} max={2800} step={50}
                  value={trainerSettings.stockfishElo}
                  onChange={e => setTrainerSettings({ stockfishElo: parseInt(e.target.value) })}
                  style={{ width:'100%', accentColor:'#81b64c', marginBottom:8 }}/>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {[400,800,1200,1600,2000,2400].map(e => (
                    <button key={e} onClick={() => setTrainerSettings({stockfishElo:e})}
                      style={{ flex:'1 0 auto', minWidth:44, padding:'3px 0', borderRadius:5, fontSize:10, fontWeight:600, border:'1px solid', cursor:'pointer',
                        borderColor: trainerSettings.stockfishElo===e ? '#81b64c' : '#3a3a37',
                        background: trainerSettings.stockfishElo===e ? 'rgba(129,182,76,.15)' : '#222220',
                        color: trainerSettings.stockfishElo===e ? '#81b64c' : '#6b6860',
                      }}>{e}</button>
                  ))}
                </div>
                <div style={{ marginTop:8, fontSize:11, color:'#6b6860', textAlign:'center' }}>
                  {trainerSettings.stockfishElo < 800 ? '🟢 Beginner' : trainerSettings.stockfishElo < 1200 ? '🟡 Intermediate' : trainerSettings.stockfishElo < 1600 ? '🟠 Advanced' : trainerSettings.stockfishElo < 2000 ? '🔴 Expert' : '🔴 Master'}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:11, color:'#a8a49c' }}>Skill Level</span>
                  <span style={{ fontSize:14, fontWeight:700, color:'#d4a843' }}>{trainerSettings.stockfishLevel} / 20</span>
                </div>
                <input type="range" min={1} max={20}
                  value={trainerSettings.stockfishLevel}
                  onChange={e => setTrainerSettings({ stockfishLevel: parseInt(e.target.value) })}
                  style={{ width:'100%', accentColor:'#81b64c' }}/>
              </div>
            )}
          </div>

          {/* Player color */}
          <div>
            <div className="section-label">Play As</div>
            <div style={{ display:'flex', gap:6 }}>
              {['white','black','random'].map(c => (
                <button key={c} onClick={() => setPlayerColor(c)}
                  style={{ flex:1, padding:'6px 0', borderRadius:6, fontSize:11, fontWeight:600, border:'1px solid', cursor:'pointer',
                    borderColor: playerColor===c ? '#81b64c' : '#3a3a37',
                    background: playerColor===c ? 'rgba(129,182,76,.15)' : '#222220',
                    color: playerColor===c ? '#81b64c' : '#6b6860',
                  }}>
                  {c === 'white' ? '☀' : c === 'black' ? '🌙' : '🎲'}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <div className="section-label">Coach Options</div>
            {[
              { key:'commentary', label:'Live Commentary' },
              { key:'showHints', label:'Show Hints' },
              { key:'showArrows', label:'Move Arrows' },
              { key:'autoAnalyze', label:'Auto Analyze' },
            ].map(o => (
              <label key={o.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', cursor:'pointer' }}>
                <span style={{ fontSize:12, color:'#a8a49c' }}>{o.label}</span>
                <div onClick={() => setTrainerSettings({ [o.key]: !trainerSettings[o.key] })}
                  style={{ width:32, height:18, borderRadius:9, background: trainerSettings[o.key] ? '#81b64c' : '#3a3a37',
                    position:'relative', transition:'.2s', cursor:'pointer' }}>
                  <div style={{ position:'absolute', top:2, left: trainerSettings[o.key] ? 16 : 2, width:14, height:14,
                    borderRadius:'50%', background:'#fff', transition:'.2s' }}/>
                </div>
              </label>
            ))}
          </div>

          {/* Stats */}
          {gameStatus !== 'idle' && (
            <div>
              <div className="section-label">Position</div>
              <div style={{ fontSize:12, color:'#a8a49c', display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>Opening</span><span style={{ color:'#ede9e0', fontWeight:500, fontSize:11 }}>{openingName}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>Material</span>
                  <span style={{ color: material.diff > 0 ? '#81b64c' : material.diff < 0 ? '#e05252' : '#a8a49c', fontWeight:600 }}>
                    {material.diff > 0 ? '+' : ''}{material.diff}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>Eval</span>
                  <span style={{ color:'#d4a843', fontWeight:600 }}>{scoreToString(evalScore, evalMate)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>Moves</span><span style={{ color:'#ede9e0' }}>{moves.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CENTER — Board */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'16px 12px', overflowY:'auto', gap:0 }}>
        {/* Player info top */}
        <PlayerBar name={playerColor==='white' ? `Stockfish (${trainerSettings.stockfishElo})` : 'You'} isEngine={playerColor==='white'} thinking={thinking && chess.turn()===(playerColor==='white'?'w':'b')} color={playerColor==='white'?'black':'white'} material={playerColor==='white'?material.black:material.white} />

        <div style={{ display:'flex', gap:10, alignItems:'stretch', marginTop:8 }}>
          <EvalBar score={evalScore} mate={evalMate} height={460} />
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

        <PlayerBar name={playerColor==='white' ? 'You' : `Stockfish (${trainerSettings.stockfishElo})`} isEngine={playerColor==='black'} thinking={thinking && chess.turn()===(playerColor==='black'?'w':'b')} color={playerColor} material={playerColor==='white'?material.white:material.black} />

        {/* Controls */}
        <div style={{ display:'flex', gap:6, marginTop:10, alignItems:'center', width:460 }}>
          <button className="btn btn-icon" onClick={() => goToMove(0)} title="Start">⏮</button>
          <button className="btn btn-icon" onClick={() => goToMove(Math.max(0,currentIdx-1))} title="Prev">◀</button>
          <span style={{ fontSize:11, color:'#6b6860', padding:'0 8px', whiteSpace:'nowrap' }}>{currentIdx} / {fenHistory.length-1}</span>
          <button className="btn btn-icon" onClick={() => goToMove(Math.min(fenHistory.length-1,currentIdx+1))} title="Next">▶</button>
          <button className="btn btn-icon" onClick={() => goToMove(fenHistory.length-1)} title="End">⏭</button>
          <div style={{ flex:1 }}/>
          <button className="btn btn-icon" title="Flip Board" onClick={() => setPlayerColor(c => c==='white'?'black':'white')}>⇅</button>
        </div>
        <MoveList moves={moves} currentIdx={currentIdx} onSelect={goToMove} />

        {/* Game over banner */}
        {gameOver && (
          <div style={{ width:460, marginTop:10, background:'rgba(129,182,76,.1)', border:'1px solid rgba(129,182,76,.3)', borderRadius:10, padding:'14px 18px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>🏁 {gameOver}</div>
            <button className="btn btn-primary" onClick={() => setShowNewGameModal(true)}>Play Again</button>
          </div>
        )}
      </div>

      {/* RIGHT — Commentary */}
      <div style={{ width:280, flexShrink:0, background:'#1e1e1c', borderLeft:'1px solid #2e2e2a', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid #2e2e2a', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'#538a2f', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🧑‍🏫</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>Coach Magnus</div>
            <div style={{ fontSize:10, color:'#81b64c', display:'flex', alignItems:'center', gap:4 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#81b64c', animation:'pulse 2s infinite' }}/>
              {thinking ? 'Engine thinking…' : 'Watching'}
            </div>
          </div>
          {thinking && <div style={{ marginLeft:'auto', width:16, height:16, border:'2px solid #3a3a37', borderTop:'2px solid #81b64c', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>}
        </div>
        <div style={{ flex:1, overflow:'hidden' }}>
          <CommentaryBox messages={commentary} />
        </div>
      </div>

      {/* New Game Modal */}
      {showNewGameModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
          onClick={() => setShowNewGameModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#222220', border:'1px solid #383834', borderRadius:16, padding:28, width:380, maxWidth:'95vw' }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, marginBottom:16 }}>New Game</h2>
            <div style={{ marginBottom:16 }}>
              <div className="section-label">Play As</div>
              <div style={{ display:'flex', gap:8 }}>
                {['white','black','random'].map(c => (
                  <button key={c} onClick={() => setPlayerColor(c)}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, fontSize:13, fontWeight:600, border:'2px solid', cursor:'pointer',
                      borderColor: playerColor===c ? '#81b64c' : '#3a3a37',
                      background: playerColor===c ? 'rgba(129,182,76,.15)' : '#222220',
                      color: playerColor===c ? '#81b64c' : '#6b6860',
                    }}>
                    {c==='white'?'☀ White':c==='black'?'🌙 Black':'🎲 Random'}
                  </button>
                ))}
              </div>
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
        <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
          background: color==='white' ? '#ede9e0' : '#2a2a27', color: color==='white' ? '#1a1a18' : '#ede9e0', border:'1px solid #464642' }}>
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
