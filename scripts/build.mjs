import {mkdir,copyFile,rm} from 'node:fs/promises';
const publicFiles=['index.html','styles.css','app.mjs','engine.mjs','multi.mjs','goals.mjs','planner.mjs','conversation.mjs'];
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of publicFiles)await copyFile(file,'dist/'+file);
console.log('Built browser assets. Server code, tests, and environment files are excluded.');
