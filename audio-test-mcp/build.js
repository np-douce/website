import { build } from 'esbuild';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
const result=await build({entryPoints:['public/player.js'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',minify:true});
const script=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const html=readFileSync('public/audio-widget.html','utf8').replace('<!-- PLAYER_SCRIPT -->','<script>'+script+'</script>');
mkdirSync('dist',{recursive:true});
writeFileSync('dist/audio-widget.html',html);
console.log('Built inline MCP Apps player');
