import React, { useRef, useEffect } from 'react';

const typeColors = { info:'#a8a49c', good:'#81b64c', warning:'#d4a843', danger:'#e05252', brilliant:'#1bade4', tip:'#4a90d9' };
const typeIcons = { info:'ℹ', good:'✓', warning:'⚠', danger:'✗', brilliant:'✦', tip:'💡' };

export default function CommentaryBox({ messages = [] }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages.length]);

  return (
    <div style={{
      display:'flex', flexDirection:'column', gap:6,
      overflowY:'auto', padding:'10px 12px', height:'100%',
      background:'#1e1e1c',
    }}>
      {messages.map((msg, i) => (
        <div key={i} style={{
          display:'flex', gap:8, alignItems:'flex-start',
          animation: i === messages.length-1 ? 'fadeIn .3s ease' : undefined,
          padding:'7px 10px', borderRadius:8,
          background: i === messages.length-1 ? 'rgba(255,255,255,.03)' : 'transparent',
        }}>
          <span style={{ fontSize:14, flexShrink:0, marginTop:1, color:typeColors[msg.type]||'#a8a49c' }}>
            {typeIcons[msg.type]||'·'}
          </span>
          <span style={{ fontSize:12.5, color:'#ede9e0', lineHeight:1.55, fontStyle: msg.italic ? 'italic' : undefined }}>
            {msg.text}
          </span>
        </div>
      ))}
      {messages.length === 0 && (
        <div style={{ textAlign:'center', padding:'20px 0', color:'#6b6860', fontSize:12 }}>
          Make a move to get coaching feedback!
        </div>
      )}
      <div ref={bottomRef}/>
    </div>
  );
}
