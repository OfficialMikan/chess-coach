import React, { useRef, useEffect } from 'react';

const CLASS_COLORS = {
  brilliant: '#1bade4', excellent: '#81b64c', good: '#81b64c',
  neutral: '#a8a49c', inaccuracy: '#d4a843', mistake: '#e07c00', blunder: '#e05252',
};
const CLASS_SYMBOLS = {
  brilliant: '✦', excellent: '✓✓', good: '✓', neutral: '·',
  inaccuracy: '?!', mistake: '?', blunder: '??',
};

export default function MoveList({ moves = [], currentIdx, onSelect }) {
  const curRef = useRef(null);
  useEffect(() => { curRef.current?.scrollIntoView({ block:'nearest', behavior:'smooth' }); }, [currentIdx]);

  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ num: Math.floor(i/2)+1, white: moves[i], black: moves[i+1] });
  }

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:2, padding:8, overflowY:'auto', maxHeight:100 }}>
      {pairs.map(({ num, white, black }) => (
        <React.Fragment key={num}>
          <span style={{ fontSize:11, color:'#6b6860', padding:'3px 2px', alignSelf:'center', minWidth:18 }}>{num}.</span>
          {white && (
            <span ref={currentIdx === (num-1)*2+1 ? curRef : null}
              onClick={() => onSelect((num-1)*2+1)}
              style={{
                fontSize:12, padding:'3px 7px', borderRadius:4, cursor:'pointer',
                background: currentIdx === (num-1)*2+1 ? '#81b64c' : 'transparent',
                color: currentIdx === (num-1)*2+1 ? '#fff' : '#a8a49c',
                borderLeft: white.class && white.class !== 'neutral' && white.class !== 'good' ? `2.5px solid ${CLASS_COLORS[white.class]}` : 'none',
                transition:'.1s', fontWeight:500, display:'flex', alignItems:'center', gap:2
              }}>
              {white.san}
              {white.class && CLASS_SYMBOLS[white.class] && white.class !== 'neutral' && white.class !== 'good' && (
                <span style={{ fontSize:10, color:CLASS_COLORS[white.class] }}>{CLASS_SYMBOLS[white.class]}</span>
              )}
            </span>
          )}
          {black && (
            <span ref={currentIdx === (num-1)*2+2 ? curRef : null}
              onClick={() => onSelect((num-1)*2+2)}
              style={{
                fontSize:12, padding:'3px 7px', borderRadius:4, cursor:'pointer',
                background: currentIdx === (num-1)*2+2 ? '#81b64c' : 'transparent',
                color: currentIdx === (num-1)*2+2 ? '#fff' : '#a8a49c',
                borderLeft: black.class && black.class !== 'neutral' && black.class !== 'good' ? `2.5px solid ${CLASS_COLORS[black.class]}` : 'none',
                transition:'.1s', fontWeight:500, display:'flex', alignItems:'center', gap:2
              }}>
              {black.san}
              {black.class && CLASS_SYMBOLS[black.class] && black.class !== 'neutral' && black.class !== 'good' && (
                <span style={{ fontSize:10, color:CLASS_COLORS[black.class] }}>{CLASS_SYMBOLS[black.class]}</span>
              )}
            </span>
          )}
        </React.Fragment>
      ))}
      {moves.length === 0 && <span style={{ fontSize:12, color:'#6b6860', padding:'4px 8px' }}>No moves yet</span>}
    </div>
  );
}
