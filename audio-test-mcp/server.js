import { createServer } from 'node:http';
import { z } from 'zod';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

const espeakRoot=resolve('./.espeak-root/usr');
process.env.PATH=resolve('./.espeak-bin')+':'+espeakRoot+'/bin:'+process.env.PATH;
process.env.LD_LIBRARY_PATH=espeakRoot+'/lib/x86_64-linux-gnu:'+espeakRoot+'/lib:'+ (process.env.LD_LIBRARY_PATH||'');
delete process.env.ESPEAK_DATA_PATH;
const URI = 'ui://audio-test/piper-p225-kiss-v6.html';
let status = 'idle';
let audioData = null;
let errorMessage = '';
let job = null;
function htmlEscape(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
async function generateHi() {
  const started = performance.now();
  status = 'loading'; errorMessage = '';
  try {
    const { PiperNativeTTS, resolveModelPathFromOptions } = await import('pipertts');
    const modelPath = await resolveModelPathFromOptions({ model: 'en_GB-vctk-medium', modelsDir: './models' });
    const tts = await PiperNativeTTS.load({ modelPath });
    const loaded = performance.now();
    console.log('Piper model load seconds:', ((loaded-started)/1000).toFixed(2));
    status = 'generating';
    const { audio } = await tts.synthesize('You know, I was going to agree with you. Then I checked the mathematics.', { speakerId: 107 });
    audioData = 'data:audio/wav;base64,' + Buffer.from(audio).toString('base64');
    status = 'ready';
    console.log('Piper speech generation seconds:', ((performance.now()-loaded)/1000).toFixed(2));
    console.log('Piper total seconds:', ((performance.now()-started)/1000).toFixed(2));
    console.log('Piper greeting ready');
  } catch (error) {
    errorMessage = error?.message || String(error);
    status = 'error';
    console.error('Piper greeting failed:', error);
  } finally { job = null; }
}
function startGeneration() {
  if (status === 'ready' || job) return;
  job = generateHi();
}

const URI7='ui://audio-test/piper-dynamic-v7.html';
const BASE='https://np-douce-audio-test-mcp.onrender.com';
const effects={
 kiss:'https://cdn.freesound.org/previews/275/275345_3173139-hq.mp3',
 giggle:'https://cdn.freesound.org/previews/275/275343_3173139-hq.mp3'
};
const tasks=new Map();
let latestTask='';
function parseScript(script){
 const pieces=String(script).split(/(\[(?:kiss|giggle|pause:\s*\d{1,4}ms)\])/gi);
 return pieces.flatMap(part=>{
  const p=part.trim(); if(!p)return [];
  if(/^\[kiss\]$/i.test(p))return [{type:'effect',url:effects.kiss}];
  if(/^\[giggle\]$/i.test(p))return [{type:'effect',url:effects.giggle}];
  const m=p.match(/^\[pause:\s*(\d{1,4})ms\]$/i);
  if(m)return [{type:'pause',ms:Math.min(3000,Number(m[1]))}];
  return [{type:'speech',text:p}];
 });
}
async function renderTask(task){
 try{
  task.status='loading';
  const {PiperNativeTTS,resolveModelPathFromOptions}=await import('pipertts');
  const modelPath=await resolveModelPathFromOptions({model:'en_GB-vctk-medium',modelsDir:'./models'});
  const tts=await PiperNativeTTS.load({modelPath});
  task.status='generating';
  for(let i=0;i<task.segments.length;i++){
   const segment=task.segments[i];
   if(segment.type==='speech'){
    const {audio}=await tts.synthesize(segment.text,{speakerId:107});
    segment.audio=Buffer.from(audio);
   }
  }
  task.status='ready';
 }catch(e){task.status='error';task.error=String(e?.message||e);}
}
function startTask(script){
 const id=crypto.randomUUID();
 const task={id,status:'queued',segments:parseScript(script),error:''};
 tasks.set(id,task);latestTask=id;
 while(tasks.size>8)tasks.delete(tasks.keys().next().value);
 renderTask(task);
 return task;
}

function makeServer() {
  const server = new McpServer({ name: 'piper-audio-test', version: '1.0.0' });
  registerAppResource(server, 'piper-p225-live-player', URI, {}, async () => {
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:white;color:#111;padding:16px;font:16px system-ui">
<h3>Piper P225 + kiss test</h3><p>Speech first, then kiss. Credit: Lemonjolly (CC BY 4.0).</p>
<p id="status">Checking recording...</p>
<audio id="player" controls preload="metadata" style="display:none;width:100%;min-height:54px"></audio>
<script>
let ready=false;
const player=document.getElementById('player');
const voiceUrl='https://np-douce-audio-test-mcp.onrender.com/audio-test/audio?v=p225-20261104';
const kissUrl='https://cdn.freesound.org/previews/275/275345_3173139-hq.mp3';
let stage='voice';
player.addEventListener('ended',async()=>{if(stage==='voice'){stage='kiss';player.src=kissUrl;document.getElementById('status').textContent='Playing kiss sound';try{await player.play();}catch(e){document.getElementById('status').textContent='Tap Play for kiss';}}else{document.getElementById('status').textContent='Finished';stage='voice';player.src=voiceUrl;}});
async function poll(){
  try{
    const response=await fetch('https://np-douce-audio-test-mcp.onrender.com/audio-test/status?v=p225-20261104',{cache:'no-store'});
    if(!response.ok)throw Error('Server unavailable');
    const data=await response.json();
    document.getElementById('status').textContent=data.status==='ready'?'Ready to play':data.status==='error'?'Error: '+data.error:'Status: '+data.status;
    if(data.status==='ready'&&!ready){
      ready=true;
      player.src=voiceUrl;
      player.style.display='block';
    }
    if(data.status==='error')return;
  }catch(err){document.getElementById('status').textContent='Waiting for server: '+err.message;}
  if(!ready)setTimeout(poll,1500);
}
poll();
</script></body></html>`;
    return { contents: [{ uri: URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
  });
  registerAppTool(server, 'test_piper_p225_kiss_v6', {
    title: 'Piper P225 + kiss ending test',
    description: "Play Piper P225 speech followed by Lemonjolly's licensed kiss recording in one player.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: URI }, 'openai/outputTemplate': URI }
  }, async () => {
    startGeneration();
    return { content: [{ type: 'text', text: status === 'ready' ? 'Piper greeting is ready. Tap Play when ready.' : 'Piper status: ' + status + (status === 'error' ? '. ' + errorMessage : '. Run again after generation completes.') }] };
  });

  registerAppResource(server,'piper-dynamic-player',URI7,{},async()=>{
   const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font:16px system-ui;padding:16px;background:white;color:#111">
<h3>Piper P225: Dynamic script</h3><p id="status">Loading script...</p>
<audio id="player" controls style="width:100%;display:none"></audio>
<button id="replay" type="button" style="display:none;margin-top:10px;padding:9px 16px;border:1px solid #888;border-radius:8px;background:#eee;color:#111;font:inherit">Replay from beginning</button>
<p style="font-size:12px">Effects: Lemonjolly, Freesound (CC BY 4.0)</p>
<script>
const base='${BASE}',audio=document.getElementById('player'),statusEl=document.getElementById('status');
let task=null,index=0,pauseTimer=null;
const replay=document.getElementById('replay');
function setFirstSegment(){
 if(!task)return;
 index=0;
 const first=task.segments[0];
 if(first?.type==='pause'){audio.removeAttribute('src');audio.load();return;}
 audio.src=first.type==='effect'?first.url:base+'/audio-test/v7/audio/'+task.id+'/0';
 index=1;
}
replay.addEventListener('click',async()=>{
 if(!task)return;
 if(pauseTimer!==null){clearTimeout(pauseTimer);pauseTimer=null;}
 audio.pause();setFirstSegment();statusEl.textContent='Replaying from beginning';
 if(task.segments[0]?.type==='pause'){await next();return;}
 try{await audio.play();}catch(e){statusEl.textContent='Tap Play to replay';}
});
async function next(){
 if(!task)return;
 if(index>=task.segments.length){statusEl.textContent='Finished';return;}
 const segment=task.segments[index++];
 if(segment.type==='pause'){statusEl.textContent='Pause';pauseTimer=setTimeout(()=>{pauseTimer=null;next();},segment.ms);return;}
 audio.src=segment.type==='effect'?segment.url:base+'/audio-test/v7/audio/'+task.id+'/'+(index-1);
 audio.style.display='block';statusEl.textContent=segment.type==='speech'?'Speaking':'Playing expression';
 try{await audio.play();}catch(e){statusEl.textContent='Tap Play to continue';}
}
audio.addEventListener('ended',next);
async function poll(){
 try{
  const r=await fetch(base+'/audio-test/v7/status',{cache:'no-store'});
  const d=await r.json();
  if(d.status==='ready'){task=d;statusEl.textContent='Ready to play';setFirstSegment();audio.style.display='block';replay.style.display='inline-block';return;}
  statusEl.textContent=d.status==='error'?'Error: '+d.error:'Status: '+d.status;
 }catch(e){statusEl.textContent='Waiting for server';}
 setTimeout(poll,1600);
}
poll();
</script></body></html>`;
   return {contents:[{uri:URI7,mimeType:RESOURCE_MIME_TYPE,text:html}]};
  });
  registerAppTool(server,'compose_piper_audio_v7',{
   title:'Piper P225 dynamic speech and expressions',
   description:'Speak arbitrary text and insert [kiss], [giggle], or [pause:500ms] markers. No deployment needed for new scripts.',
   inputSchema:{script:z.string().min(1).max(1200)},
   _meta:{ui:{resourceUri:URI7},'openai/outputTemplate':URI7}
  },async({script})=>{
   const task=startTask(script);
   return {content:[{type:'text',text:'Queued audio script '+task.id+'. The embedded player will load it.'}]};
  });
  return server;
}
const port = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if(url.pathname==='/audio-test/v7/status'&&req.method==='GET'){
   const task=tasks.get(latestTask);
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*'});
   res.end(JSON.stringify(task?{id:task.id,status:task.status,error:task.error,segments:task.segments.map(({type,text,url,ms})=>({type,text,url,ms}))}:{status:'idle'}));return;
  }
  if(url.pathname.startsWith('/audio-test/v7/audio/')&&req.method==='GET'){
   const [, , , ,id,number]=url.pathname.split('/');
   const task=tasks.get(id),segment=task?.segments[Number(number)];
   if(!segment?.audio){res.writeHead(404).end('Not ready');return;}
   res.writeHead(200,{'content-type':'audio/wav','content-length':segment.audio.length,'access-control-allow-origin':'*','cache-control':'no-store'});
   res.end(segment.audio);return;
  }
  if (url.pathname === '/audio-test/status' && req.method === 'GET') {
    res.writeHead(200, {'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*'});
    res.end(JSON.stringify({status,error:errorMessage}));return;
  }
  if (url.pathname === '/audio-test/audio' && req.method === 'GET') {
    if (!audioData) {res.writeHead(404).end('Audio not ready');return;}
    const audio=Buffer.from(audioData.split(',')[1],'base64');
    res.writeHead(200,{'content-type':'audio/wav','content-length':audio.length,'cache-control':'no-store','access-control-allow-origin':'*'});
    res.end(audio);return;
  }
  if (url.pathname === '/' && req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Piper greeting MCP: ' + status); return; }
  if (url.pathname !== '/mcp') { res.writeHead(404).end('Not found'); return; }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, mcp-session-id, mcp-protocol-version, accept' }).end(); return; }
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try { await server.connect(transport); await transport.handleRequest(req, res); }
  catch (error) { console.error(error); if (!res.headersSent) res.writeHead(500).end('MCP error'); }
}).listen(port, '0.0.0.0', () => console.log('Piper greeting listening on ' + port));
