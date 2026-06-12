import { Chess } from 'chess.js';

export const PIECE_SYMBOLS = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟',
};

export const PIECE_VALUES = { p:1, n:3, b:3, r:5, q:9, k:0 };

export function classifyMove(prevFen, moveSan, stockfishScoreBefore, stockfishScoreAfter, playerColor) {
  const delta = playerColor === 'w'
    ? stockfishScoreAfter - stockfishScoreBefore
    : stockfishScoreBefore - stockfishScoreAfter;

  if (delta >= 1.5) return 'brilliant';
  if (delta >= 0.3) return 'good';
  if (delta >= -0.2) return 'neutral';
  if (delta >= -0.5) return 'inaccuracy';
  if (delta >= -1.5) return 'mistake';
  return 'blunder';
}

export function getMoveClassification(delta) {
  if (delta >= 1.5) return { label: 'Brilliant!!', emoji: '✦', color: '#1bade4', class: 'brilliant' };
  if (delta >= 0.5) return { label: 'Excellent!', emoji: '✓', color: '#81b64c', class: 'excellent' };
  if (delta >= 0) return { label: 'Good', emoji: '·', color: '#81b64c', class: 'good' };
  if (delta >= -0.3) return { label: 'Neutral', emoji: '·', color: '#a8a49c', class: 'neutral' };
  if (delta >= -0.8) return { label: 'Inaccuracy', emoji: '?!', color: '#d4a843', class: 'inaccuracy' };
  if (delta >= -2.0) return { label: 'Mistake', emoji: '?', color: '#e07c00', class: 'mistake' };
  return { label: 'Blunder!!', emoji: '??', color: '#e05252', class: 'blunder' };
}

export function getOpeningName(moves) {
  const openings = {
    'e4 e5 Nf3 Nc6 Bc4': 'Italian Game',
    'e4 e5 Nf3 Nc6 Bb5': 'Ruy López',
    'e4 e5 Nf3 Nf6': "Petrov's Defense",
    'e4 c5': 'Sicilian Defense',
    'e4 c5 Nf3 d6': 'Sicilian — Najdorf prep',
    'e4 e6': 'French Defense',
    'e4 c6': 'Caro-Kann Defense',
    'd4 d5': "Queen's Pawn",
    'd4 d5 c4': "Queen's Gambit",
    'd4 Nf6': "Indian Defense",
    'd4 Nf6 c4 g6': "King's Indian Defense",
    'Nf3 d5 c4': "English Opening",
    'e4 e5 Nf3 Nc6 d4': 'Scotch Game',
    'e4 e5 Nf3 Nc6 Bc4 Bc5': 'Giuoco Piano',
    'e4 e5 f4': "King's Gambit",
  };
  const key = moves.slice(0, 5).join(' ');
  for (const [pattern, name] of Object.entries(openings)) {
    if (key.startsWith(pattern)) return name;
  }
  return 'Custom Opening';
}

export function getMaterialCount(fen) {
  const vals = { p:1, n:3, b:3, r:5, q:9 };
  let white = 0, black = 0;
  const position = fen.split(' ')[0];
  for (const ch of position) {
    const lc = ch.toLowerCase();
    if (vals[lc]) {
      if (ch === ch.toUpperCase()) white += vals[lc];
      else black += vals[lc];
    }
  }
  return { white, black, diff: white - black };
}

export function buildFenHistory(pgn) {
  const c = new Chess();
  const fens = [c.fen()];
  const moves = [];
  try {
    c.load_pgn(pgn, { sloppy: true });
    const history = c.history({ verbose: true });
    const replay = new Chess();
    for (const m of history) {
      replay.move(m);
      fens.push(replay.fen());
      moves.push(m);
    }
  } catch(e) {}
  return { fens, moves };
}

export function lanToSan(chess, lan) {
  if (!lan || lan === '(none)') return null;
  try {
    const m = chess.move({ from: lan.slice(0,2), to: lan.slice(2,4), promotion: lan[4] || 'q' });
    if (m) { chess.undo(); return m.san; }
  } catch(e) {}
  return null;
}

export function scoreToString(score, mate) {
  if (mate !== undefined) return `M${Math.abs(mate)}`;
  if (score === undefined) return '0.0';
  const s = score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  return s;
}

export function getAttackedSquares(chess, color) {
  const attacked = new Set();
  chess.board().forEach((row, r) => {
    row.forEach((piece, f) => {
      if (piece && piece.color === color) {
        const moves = chess.moves({ square: 'abcdefgh'[f] + (8-r), verbose: true });
        moves.forEach(m => attacked.add(m.to));
      }
    });
  });
  return attacked;
}

export const ELO_TO_LEVEL = [
  { elo: 400, level: 1 }, { elo: 600, level: 2 }, { elo: 800, level: 3 },
  { elo: 1000, level: 4 }, { elo: 1200, level: 5 }, { elo: 1400, level: 6 },
  { elo: 1600, level: 7 }, { elo: 1800, level: 8 }, { elo: 2000, level: 9 },
  { elo: 2200, level: 10 }, { elo: 2400, level: 15 }, { elo: 2600, level: 18 },
  { elo: 2800, level: 20 },
];

export const PUZZLES = [
  { id:'p1', title:'Mate in 1', fen:'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', solution:['h5f7'], hint:'Queen strikes f7!', rating:600, theme:'Mate' },
  { id:'p2', title:'Fork Tactic', fen:'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq e6 0 3', solution:['f3g5'], hint:'Knight attacks two pieces', rating:900, theme:'Fork' },
  { id:'p3', title:'Pin & Win', fen:'rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 4', solution:['c4f7'], hint:'The bishop eyes f7', rating:1000, theme:'Pin' },
  { id:'p4', title:'Back Rank Mate', fen:'6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', solution:['d1d8'], hint:'Attack the weak back rank', rating:1100, theme:'Mate' },
  { id:'p5', title:'Discovered Attack', fen:'r3k2r/ppp2ppp/2n1bn2/3qp3/3P4/2NB1N2/PPP1QPPP/R3K2R w KQkq - 4 9', solution:['d4e5'], hint:'Moving exposes a hidden attacker', rating:1300, theme:'Discovery' },
  { id:'p6', title:'Skewer', fen:'4k3/8/8/8/8/8/1r6/R3K3 w Q - 0 1', solution:['a1a8'], hint:'Force the king, win the rook', rating:1200, theme:'Skewer' },
  { id:'p7', title:'Queen Sacrifice', fen:'r4rk1/pp3ppp/2p5/4Pb2/2B2P2/q5Q1/P4PPP/1R3RK1 w - - 0 1', solution:['g3g7'], hint:'Sacrifice to deliver checkmate', rating:1500, theme:'Sacrifice' },
  { id:'p8', title:'Zwischenzug', fen:'r1bq1rk1/ppp2ppp/2n2n2/3pp3/1bPP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 6', solution:['f3e5'], hint:'An in-between move changes everything', rating:1400, theme:'Tactics' },
];
