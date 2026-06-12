import React, { useState, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';

const PIECE_SVG = {
  wK: (c='#fff') => <svg viewBox="0 0 45 45"><g fill={c} stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22.5 11.63V6M20 8h5" strokeLinecap="square"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V17s-5.5 3.5-5.5 10c0 6.5 5.5 10.5 5.5 10.5z" strokeLinecap="butt"/><path d="M11.5 37c0 3.5 7.5 6 11 6s11-2.5 11-6" fill="none"/><path d="M11.5 30c0 3.5 7.5 5.5 11 5.5S33.5 33.5 33.5 30" fill="none"/></g></svg>,
  wQ: (c='#fff') => <svg viewBox="0 0 45 45"><g fill={c} stroke="#000" strokeWidth="1.5" strokeLinejoin="round"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/><path d="M9 26c8.5-8.5 15.5-6 22.5 0M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4" fill="none" strokeLinecap="butt"/></g></svg>,
  wR: (c='#fff') => <svg viewBox="0 0 45 45"><g fill={c} stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z" strokeLinecap="butt"/><path d="M14 29.5v-13h17v13H14z" strokeLinecap="butt" strokeLinejoin="miter"/><path d="M9 9h4v2.5H11v2.5h2.5v2.5H11v2.5h4v2H9V9zM36 9h-4v2.5h2.5v2.5H32v2.5h2.5v2.5H31v2H36V9z" strokeLinecap="butt"/></g></svg>,
  wB: (c='#fff') => <svg viewBox="0 0 45 45"><g fill={c} stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><g fill="none" strokeLinecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><circle cx="22.5" cy="8" r="2.5"/></g></g></svg>,
  wN: (c='#fff') => <svg viewBox="0 0 45 45"><g fill={c} stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 5.12-1.5 11.5-4 14.5l-5.5 1v3h16v-3h-3.5c3.5-3.5 4-6.5 3-14.5"/><path d="M9.5 25.5a6.5 6.5 0 0 0 5 5.5c3 .5 5.5-2.5 6-4.5 1.5-5.5-3-10.5-8-11-3-.5-5 .5-5.5 2.5-.5 2 .5 4.5 2.5 7.5z"/></g></svg>,
  wP: (c='#fff') => <svg viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill={c} stroke="#000" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  bK: () => <svg viewBox="0 0 45 45"><g fill="#1a1a1a" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22.5 11.63V6M20 8h5" stroke="#aaa" strokeLinecap="square"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V17s-5.5 3.5-5.5 10c0 6.5 5.5 10.5 5.5 10.5z" strokeLinecap="butt"/><path d="M11.5 37c0 3.5 7.5 6 11 6s11-2.5 11-6" fill="none" stroke="#666"/><path d="M11.5 30c0 3.5 7.5 5.5 11 5.5S33.5 33.5 33.5 30" fill="none" stroke="#666"/></g></svg>,
  bQ: () => <svg viewBox="0 0 45 45"><g stroke="#333" strokeWidth="1.5" strokeLinejoin="round"><circle cx="6" cy="12" r="2.75" fill="#1a1a1a"/><circle cx="14" cy="9" r="2.75" fill="#1a1a1a"/><circle cx="22.5" cy="8" r="2.75" fill="#1a1a1a"/><circle cx="31" cy="9" r="2.75" fill="#1a1a1a"/><circle cx="39" cy="12" r="2.75" fill="#1a1a1a"/><path d="M9 26c8.5-8.5 15.5-6 22.5 0M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4" fill="#1a1a1a" strokeLinecap="butt"/></g></svg>,
  bR: () => <svg viewBox="0 0 45 45"><g fill="#1a1a1a" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z" strokeLinecap="butt"/><path d="M14 29.5v-13h17v13H14z" strokeLinecap="butt" strokeLinejoin="miter"/><path d="M9 9h4v2.5H11v2.5h2.5v2.5H11v2.5h4v2H9V9zM36 9h-4v2.5h2.5v2.5H32v2.5h2.5v2.5H31v2H36V9z" strokeLinecap="butt"/></g></svg>,
  bB: () => <svg viewBox="0 0 45 45"><g fill="#1a1a1a" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><g fill="none" strokeLinecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><circle cx="22.5" cy="8" r="2.5"/></g></g></svg>,
  bN: () => <svg viewBox="0 0 45 45"><g fill="#1a1a1a" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 5.12-1.5 11.5-4 14.5l-5.5 1v3h16v-3h-3.5c3.5-3.5 4-6.5 3-14.5"/><path d="M9.5 25.5a6.5 6.5 0 0 0 5 5.5c3 .5 5.5-2.5 6-4.5 1.5-5.5-3-10.5-8-11-3-.5-5 .5-5.5 2.5-.5 2 .5 4.5 2.5 7.5z"/><circle cx="16.5" cy="20.5" r="1.5" fill="#fff" stroke="none"/></g></svg>,
  bP: () => <svg viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#1a1a1a" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/></svg>,
};

function renderPiece(type, color) {
  const key = color + type.toUpperCase();
  const fn = PIECE_SVG[key];
  if (!fn) return null;
  return (
    <div style={{ width:'85%', height:'85%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      {fn()}
    </div>
  );
}

// Arrow SVG overlay
function Arrows({ arrows, boardSize }) {
  const sqSize = boardSize / 8;
  const sqCenter = (file, rank, flipped) => {
    const col = flipped ? 7 - 'abcdefgh'.indexOf(file) : 'abcdefgh'.indexOf(file);
    const row = flipped ? rank - 1 : 8 - rank;
    return { x: col * sqSize + sqSize / 2, y: row * sqSize + sqSize / 2 };
  };

  return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:5 }}>
      <defs>
        <marker id="arrowGreen" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#81b64c" opacity=".85"/>
        </marker>
        <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#4a90d9" opacity=".85"/>
        </marker>
        <marker id="arrowRed" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="#e05252" opacity=".85"/>
        </marker>
      </defs>
      {arrows.map((a, i) => {
        const from = sqCenter(a.from[0], parseInt(a.from[1]), a.flipped);
        const to = sqCenter(a.to[0], parseInt(a.to[1]), a.flipped);
        const color = a.color || 'Green';
        return (
          <line key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={color === 'Green' ? '#81b64c' : color === 'Blue' ? '#4a90d9' : '#e05252'}
            strokeWidth={sqSize * 0.18} strokeLinecap="round" opacity=".85"
            markerEnd={`url(#arrow${color})`}
          />
        );
      })}
    </svg>
  );
}

export default function ChessBoard({
  fen,
  flipped = false,
  onMove,
  arrows = [],
  highlightSquares = {},
  interactive = true,
  showCoords = true,
  boardSize,
}) {
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [promoDialog, setPromoDialog] = useState(null);
  const [dragPiece, setDragPiece] = useState(null);

  const chess = useMemo(() => {
    try { return new Chess(fen); } catch(e) { return new Chess(); }
  }, [fen]);

  const board2d = chess.board();
  const files = 'abcdefgh';

  const sqName = (row, col) => files[flipped ? 7-col : col] + (flipped ? row+1 : 8-row);

  const handleSqClick = useCallback((sq, piece) => {
    if (!interactive) return;
    if (selected) {
      if (legalTargets.includes(sq)) {
        const from = selected;
        // Check promo
        const p = chess.get(from);
        const toRank = sq[1];
        if (p && p.type === 'p' && ((p.color === 'w' && toRank === '8') || (p.color === 'b' && toRank === '1'))) {
          setPromoDialog({ from, to: sq, color: p.color });
          return;
        }
        const result = chess.move({ from, to: sq, promotion: 'q' });
        if (result && onMove) onMove(result);
        setSelected(null); setLegalTargets([]);
      } else if (piece && piece.color === chess.turn()) {
        setSelected(sq);
        setLegalTargets(chess.moves({ square: sq, verbose: true }).map(m => m.to));
      } else {
        setSelected(null); setLegalTargets([]);
      }
    } else {
      if (piece && piece.color === chess.turn()) {
        setSelected(sq);
        setLegalTargets(chess.moves({ square: sq, verbose: true }).map(m => m.to));
      }
    }
  }, [selected, legalTargets, chess, interactive, onMove]);

  const handlePromo = (piece) => {
    const { from, to } = promoDialog;
    const result = chess.move({ from, to, promotion: piece });
    if (result && onMove) onMove(result);
    setPromoDialog(null); setSelected(null); setLegalTargets([]);
  };

  const sz = boardSize || 480;
  const sqSz = sz / 8;

  return (
    <div style={{ position:'relative', width:sz, height:sz, flexShrink:0, borderRadius:4, overflow:'hidden', border:'2px solid #464642', boxShadow:'0 8px 40px rgba(0,0,0,.5)' }}>
      {/* Squares */}
      {Array.from({ length:8 }, (_, row) =>
        Array.from({ length:8 }, (_, col) => {
          const dr = flipped ? 7-row : row;
          const dc = flipped ? 7-col : col;
          const piece = board2d[dr][dc];
          const sq = sqName(row, col);
          const isLight = (dr+dc) % 2 === 0;
          const isSel = sq === selected;
          const isTarget = legalTargets.includes(sq);
          const isCheck = sq[0] === chess.board().flat().find(p => p?.type==='k'&&p?.color===chess.turn())?.square?.[0] && chess.in_check();
          const hl = highlightSquares[sq];

          let bg = isLight ? '#f0d9b5' : '#b58863';
          if (isSel) bg = isLight ? '#f6f096' : '#baca2b';
          if (hl === 'last') bg = isLight ? '#cdd26a' : '#aaa23a';
          if (hl === 'check') bg = 'radial-gradient(circle,#e05252 30%,rgba(224,82,82,.3) 70%,transparent 80%)';

          return (
            <div key={`${row}-${col}`}
              onClick={() => handleSqClick(sq, piece)}
              style={{
                position:'absolute', left:col*sqSz, top:row*sqSz, width:sqSz, height:sqSz,
                background: hl === 'check' ? bg : bg,
                backgroundImage: hl === 'check' ? bg : undefined,
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor: interactive ? 'pointer' : 'default',
                userSelect:'none',
              }}
            >
              {/* Highlight overlay */}
              {hl && hl !== 'check' && hl !== 'last' && (
                <div style={{ position:'absolute', inset:0, background: hl === 'best' ? 'rgba(74,144,217,.35)' : hl === 'good' ? 'rgba(129,182,76,.35)' : 'rgba(224,82,82,.3)' }} />
              )}
              {/* Piece */}
              {piece && renderPiece(piece.type, piece.color)}
              {/* Legal move dot */}
              {isTarget && !piece && (
                <div style={{ width:'32%', height:'32%', borderRadius:'50%', background:'rgba(0,0,0,.2)', zIndex:2 }} />
              )}
              {isTarget && piece && (
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', boxShadow:'inset 0 0 0 4px rgba(0,0,0,.3)', zIndex:2 }} />
              )}
              {/* Coords */}
              {showCoords && col===0 && <span style={{ position:'absolute', top:2, left:3, fontSize:9.5, fontWeight:700, color: isLight?'#b58863':'#f0d9b5', opacity:.8, zIndex:3 }}>{flipped?row+1:8-row}</span>}
              {showCoords && row===7 && <span style={{ position:'absolute', bottom:2, right:3, fontSize:9.5, fontWeight:700, color: isLight?'#b58863':'#f0d9b5', opacity:.8, zIndex:3 }}>{files[flipped?7-col:col]}</span>}
            </div>
          );
        })
      )}
      {/* Arrows */}
      {arrows.length > 0 && <Arrows arrows={arrows.map(a=>({...a,flipped}))} boardSize={sz} />}
      {/* Promotion dialog */}
      {promoDialog && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:20 }}>
          <div style={{ background:'#2a2a27', border:'1px solid #464642', borderRadius:12, padding:16, display:'flex', gap:12 }}>
            {['q','r','b','n'].map(p => (
              <div key={p} onClick={() => handlePromo(p)}
                style={{ width:64, height:64, background:'#3a3a37', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'1px solid #464642' }}>
                <div style={{ width:'80%', height:'80%' }}>{renderPiece(p, promoDialog.color)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
