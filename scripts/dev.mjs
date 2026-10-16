import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import handler from '../api/chat.mjs';
const files=new Set(['index.html','styles.css','app.mjs','engine.mjs','multi.mjs','goals.mjs','planner.mjs','conversation.mjs']);
const types={html:'text/html',css:'text/css',mjs:'text/javascript'};
createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/chat'){
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000){res.writeHead(413);res.end();return;}}
  try{req.body=body?JSON.parse(body):null;}catch{res.writeHead(400);res.end();return;}
  await handler(req,res);return;
 }
 const file=path==='/'?'index.html':path.slice(1);
 if(!files.has(file)){res.writeHead(404);res.end('Not found');return;}
 try{res.setHeader('Content-Type',types[file.split('.').at(-1)]);res.setHeader('Cache-Control','no-store');res.end(await readFile(new URL('../'+file,import.meta.url)));}catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Can I? is ready at http://localhost:'+(process.env.PORT||3000)));
