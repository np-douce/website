import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
const html=readFileSync(new URL('./public/audio-widget.html',import.meta.url),'utf8');
const URI='ui://audio-test/player.html';
function makeServer(){
 const server=new McpServer({name:'audio-test-mcp',version:'0.1.0'});
 registerAppResource(server,'audio-player',URI,{},async()=>({contents:[{uri:URI,mimeType:RESOURCE_MIME_TYPE,text:html}]}));
 registerAppTool(server,'speak_text',{
  title:'Audio Test: Play speech',description:'Shows an inline Play/Stop audio widget using free browser speech synthesis. Does not use the ChatGPT internal voice engine.',
  inputSchema:{text:z.string().min(1).max(2000)},
  annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  _meta:{ui:{resourceUri:URI},'openai/outputTemplate':URI}
 },async({text})=>({content:[{type:'text',text:'Audio test ready. Tap Play in the widget.'}],structuredContent:{text}}));
 return server;
}
const port=Number(process.env.PORT||8787);
createServer(async(req,res)=>{
 const url=new URL(req.url||'/', 'http://localhost');
 if(url.pathname==='/'&&req.method==='GET'){res.writeHead(200,{'content-type':'text/plain'});res.end('Audio Test MCP running at /mcp');return;}
 if(url.pathname!=='/mcp'){res.writeHead(404).end('Not found');return;}
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Expose-Headers','Mcp-Session-Id');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST, GET, DELETE, OPTIONS','Access-Control-Allow-Headers':'content-type, mcp-session-id, mcp-protocol-version, accept'}).end();return;}
 const server=makeServer();
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 try{await server.connect(transport);await transport.handleRequest(req,res);}
 catch(e){console.error(e);if(!res.headersSent)res.writeHead(500).end('MCP error');}
}).listen(port,'0.0.0.0',()=>console.log('Audio Test listening on '+port));
