import { App } from '@modelcontextprotocol/ext-apps';
const player=document.getElementById('player');
const status=document.getElementById('status');
const details=document.getElementById('details');
let gotResult=false;
const report=(s)=>{status.textContent=s;};
window.addEventListener('error',e=>report('Widget JavaScript error: '+e.message));
window.addEventListener('unhandledrejection',e=>report('Widget error: '+String(e.reason)));
report('Widget HTML and JavaScript loaded. Connecting...');
try{
 const app=new App({name:'Audio Test Player',version:'0.5.0'},{});
 app.ontoolresult=(result)=>{
  gotResult=true;
  const data=result?.structuredContent||{};
  details.textContent='Tool result received; audio characters: '+(data.audioDataUrl?.length||0);
  if(typeof data.audioDataUrl==='string'){
   player.src=data.audioDataUrl;
   player.load();
   report('Audio received. Tap Play.');
  }else report('Tool result arrived without audio.');
 };
 player.addEventListener('error',()=>report('Audio element failed to load WAV.'));
 app.connect().then(()=>{if(!gotResult)report('Connected; waiting for tool result.');}).catch(e=>report('Bridge connection failed: '+e.message));
}catch(e){report('Widget startup failed: '+e.message);}
