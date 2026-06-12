// Stockfish wrapper — uses stockfish.js from CDN via Worker
let worker = null;
let callbacks = {};
let cbId = 0;

function getWorker() {
  if (!worker) {
    // Use stockfish from CDN via blob worker
    const workerCode = `
      importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e) => {
      const line = e.data;
      Object.values(callbacks).forEach(cb => cb(line));
    };
    worker.postMessage('uci');
  }
  return worker;
}

export function sendCommand(cmd) {
  try { getWorker().postMessage(cmd); } catch(e) { console.error('SF error', e); }
}

export function onLine(cb) {
  const id = cbId++;
  callbacks[id] = cb;
  return () => delete callbacks[id];
}

export function setSkillLevel(level) {
  sendCommand('setoption name Skill Level value ' + level);
}

export function setElo(elo) {
  sendCommand('setoption name UCI_LimitStrength value true');
  sendCommand('setoption name UCI_Elo value ' + elo);
}

export function setUnlimited() {
  sendCommand('setoption name UCI_LimitStrength value false');
  sendCommand('setoption name Skill Level value 20');
}

export function analyzePosition(fen, depth = 15, multiPV = 3) {
  return new Promise((resolve) => {
    const lines = [];
    sendCommand('stop');
    sendCommand('position fen ' + fen);
    sendCommand('setoption name MultiPV value ' + multiPV);
    
    let timeout;
    const unsub = onLine((line) => {
      if (line.startsWith('info depth')) lines.push(line);
      if (line.startsWith('bestmove')) {
        clearTimeout(timeout);
        unsub();
        resolve({ bestmove: line.split(' ')[1], lines });
      }
    });
    
    sendCommand('go depth ' + depth);
    timeout = setTimeout(() => {
      sendCommand('stop');
    }, 8000);
  });
}

export function getBestMove(fen, movetime = 1000) {
  return new Promise((resolve) => {
    sendCommand('stop');
    sendCommand('position fen ' + fen);
    const unsub = onLine((line) => {
      if (line.startsWith('bestmove')) {
        unsub();
        const parts = line.split(' ');
        resolve({ best: parts[1], ponder: parts[3] });
      }
    });
    sendCommand('go movetime ' + movetime);
  });
}

export function parseInfo(infoLine) {
  const parts = infoLine.split(' ');
  const result = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'depth') result.depth = parseInt(parts[i+1]);
    if (parts[i] === 'score') {
      if (parts[i+1] === 'cp') result.score = parseInt(parts[i+2]) / 100;
      if (parts[i+1] === 'mate') result.mate = parseInt(parts[i+2]);
    }
    if (parts[i] === 'pv') result.pv = parts.slice(i+1).join(' ');
    if (parts[i] === 'multipv') result.multipv = parseInt(parts[i+1]);
  }
  return result;
}

export function ucfToSan(chess, ucf) {
  if (!ucf || ucf === '(none)') return null;
  try {
    const from = ucf.slice(0, 2);
    const to = ucf.slice(2, 4);
    const promo = ucf[4] || undefined;
    const m = chess.move({ from, to, promotion: promo || 'q' });
    if (m) { chess.undo(); return m.san; }
  } catch(e) {}
  return null;
}
