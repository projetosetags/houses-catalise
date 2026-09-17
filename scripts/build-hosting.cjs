const fs=require('node:fs'),path=require('node:path');
fs.mkdirSync('dist',{recursive:true});
for(const f of fs.readdirSync('.'))if(/\.(html|js|css)$/.test(f)||f==='manifest.json')fs.copyFileSync(f,path.join('dist',f));
for(const folder of ['assets','pastores'])fs.cpSync(folder,path.join('dist',folder),{recursive:true});
console.log('Frontend assembled in dist/; server code and private files excluded.');
