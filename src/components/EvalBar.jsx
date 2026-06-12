import React from 'react';

export default function EvalBar({ score, mate, orientation = 'white', height = 480 }) {
  let whitePct = 50;
  if (mate !== undefined && mate !== null) {
    whitePct = mate > 0 ? 95 : 5;
  } else if (score !== undefined && score !== null) {
    // Sigmoid-like conversion
    whitePct = Math.max(5, Math.min(95, 50 + score * 8));
  }
  const blackPct = 100 - whitePct;
  const displayScore = mate !== undefined && mate !== null
    ? (mate > 0 ? `M${Math.abs(mate)}` : `-M${Math.abs(mate)}`)
    : score !== undefined && score !== null
    ? (score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1))
    : '0.0';

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <div style={{ width:14, height, background:'#2a2a27', borderRadius:4, overflow:'hidden', display:'flex', flexDirection:'column', border:'1px solid #3a3a37' }}>
        <div style={{ background:'#1a1a18', height:`${blackPct}%`, transition:'height .5s ease', flexShrink:0 }}/>
        <div style={{ background:'#f0ece4', flex:1, transition:'flex .5s ease' }}/>
      </div>
      <div style={{ fontSize:9, fontWeight:700, color:'#6b6860', letterSpacing:.3 }}>{displayScore}</div>
    </div>
  );
}
