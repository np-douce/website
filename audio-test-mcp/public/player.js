import { App } from '@modelcontextprotocol/ext-apps';
const player=document.getElementById('player');
const status=document.getElementById('status');
const app=new App({name:'Audio Test Player',version:'0.4.0'},{});
app.ontoolresult=(result)=>{
 const data=result.structuredContent||{};
 if(typeof data.audioDataUrl==='string'){
  player.src=data.audioDataUrl;
  player.load();
  status.textContent='Audio ready. Tap Play.';
 }else status.textContent='Tool result received, but audio was missing.';
};
player.addEventListener('error',()=>{status.textContent='Audio playback error';});
app.connect().then(()=>{status.textContent='Connected. Waiting for audio result...';}).catch(e=>{status.textContent='Player connection failed: '+e.message;});
