import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

const URI = 'ui://audio-test/kokoro-greeting-v4.html';
let status = 'idle';
let audioData = null;
let errorMessage = '';
let job = null;
function htmlEscape(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
async function generateHi() {
  const started = performance.now();
  status = 'loading'; errorMessage = '';
  try {
    const { KokoroTTS } = await import('kokoro-js');
    const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
    const loaded = performance.now();
    console.log('Kokoro model load seconds:', ((loaded-started)/1000).toFixed(2));
    status = 'generating';
    const audio = await tts.generate('Hi, how are you?', { voice: 'af_heart', speed: 1 });
    const wav = await audio.toWav();
    audioData = 'data:audio/wav;base64,' + Buffer.from(wav).toString('base64');
    status = 'ready';
    console.log('Kokoro speech generation seconds:', ((performance.now()-loaded)/1000).toFixed(2));
    console.log('Kokoro total seconds:', ((performance.now()-started)/1000).toFixed(2));
    console.log('Kokoro greeting ready');
  } catch (error) {
    errorMessage = error?.message || String(error);
    status = 'error';
    console.error('Kokoro greeting failed:', error);
  } finally { job = null; }
}
function startGeneration() {
  if (status === 'ready' || job) return;
  job = generateHi();
}
function makeServer() {
  const server = new McpServer({ name: 'kokoro-audio-test', version: '1.0.0' });
  registerAppResource(server, 'kokoro-hi-player', URI, {}, async () => {
    const body = audioData
      ? '<h3>Kokoro: Hi, how are you?</h3><audio controls preload="metadata" style="display:block;width:100%;min-height:54px" src="' + audioData + '"></audio>'
      : '<h3>Kokoro: Hi, how are you?</h3><p>' + (status === 'error' ? 'Generation failed: ' + htmlEscape(errorMessage) : 'Status: ' + htmlEscape(status) + '. Run the test again after the model finishes loading.') + '</p>';
    return { contents: [{ uri: URI, mimeType: RESOURCE_MIME_TYPE, text: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:white;color:#111;padding:16px;font:16px system-ui">' + body + '</body></html>' }] };
  });
  registerAppTool(server, 'test_kokoro_greeting_v4', {
    title: 'Kokoro: timed greeting',
    description: "Generate Hi, how are you? using Kokoro neural TTS and measure loading and synthesis time. Run again after generation to play the cached WAV.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: URI }, 'openai/outputTemplate': URI }
  }, async () => {
    startGeneration();
    return { content: [{ type: 'text', text: status === 'ready' ? 'Kokoro greeting is ready. Tap Play.' : 'Kokoro status: ' + status + (status === 'error' ? '. ' + errorMessage : '. Run again after generation completes.') }] };
  });
  return server;
}
const port = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/' && req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Kokoro greeting MCP: ' + status); return; }
  if (url.pathname !== '/mcp') { res.writeHead(404).end('Not found'); return; }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, mcp-session-id, mcp-protocol-version, accept' }).end(); return; }
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try { await server.connect(transport); await transport.handleRequest(req, res); }
  catch (error) { console.error(error); if (!res.headersSent) res.writeHead(500).end('MCP error'); }
}).listen(port, '0.0.0.0', () => console.log('Kokoro greeting listening on ' + port));
