import React from 'react';
import { useStore } from '../store/useStore';

const typeStyles = {
  info: { bg:'#2a2a27', border:'#3a3a37', icon:'ℹ', color:'#a8a49c' },
  success: { bg:'rgba(129,182,76,.12)', border:'rgba(129,182,76,.3)', icon:'✓', color:'#81b64c' },
  error: { bg:'rgba(224,82,82,.12)', border:'rgba(224,82,82,.3)', icon:'✗', color:'#e05252' },
  warning: { bg:'rgba(212,168,67,.12)', border:'rgba(212,168,67,.3)', icon:'⚠', color:'#d4a843' },
};

export default function Notifications() {
  const { notifications } = useStore();
  return (
    <div style={{ position:'fixed', bottom:20, right:20, display:'flex', flexDirection:'column', gap:8, zIndex:1000, pointerEvents:'none' }}>
      {notifications.map(n => {
        const s = typeStyles[n.type] || typeStyles.info;
        return (
          <div key={n.id} style={{
            background:s.bg, border:`1px solid ${s.border}`, borderRadius:10,
            padding:'10px 16px', fontSize:13, fontWeight:500, color:'#ede9e0',
            display:'flex', alignItems:'center', gap:8,
            boxShadow:'0 4px 20px rgba(0,0,0,.4)', animation:'fadeIn .25s ease',
            maxWidth:320,
          }}>
            <span style={{ color:s.color, fontSize:16 }}>{s.icon}</span>
            {n.msg}
          </div>
        );
      })}
    </div>
  );
}
