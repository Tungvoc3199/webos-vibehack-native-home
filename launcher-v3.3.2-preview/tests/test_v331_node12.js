/* Isolated Node v12.21.0 runtime integration: real backend child, loopback only.
 * No TV, root, native Home or network beyond 127.0.0.1.
 */
'use strict';
const cp=require('child_process'),fs=require('fs'),os=require('os'),path=require('path'),
      http=require('http'),assert=require('assert');
const NODE12='F:\\TV-LG\\vibehack\\candidate\\node12-compat-offline-20261029\\node-v12.21.0-win-x64\\node.exe';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v327-node12-'));
const port=18982,root=__dirname;
const jpg=fs.readFileSync(path.join(root,'app/wallpapers/presets/aurora_lake.jpg'));
const ctl='b'.repeat(64);
let child=null;
function start(fail){
 return new Promise((resolve,reject)=>{
  const env={...process.env,TV_WALLPAPER_TEST_MODE:'1',WALLPAPER_BIND:'127.0.0.1',
   WALLPAPER_PORT:String(port),TV_LAN_IP:'127.0.0.1',TV_WALLPAPER_DATA_DIR:dir,
   TV_WALLPAPER_TEST_CONTROL_TOKEN:ctl,INJECT_UNLINK_FAIL:fail?'1':'0'};
  const boot=`var fs=require('fs'),p=require('path');if(process.env.INJECT_UNLINK_FAIL==='1'){
   var original=fs.unlinkSync;fs.unlinkSync=function(file){
     if(/\\.jpg$/.test(String(file)))throw Error('INJECTED_DELETE_FAILURE');
     return original.apply(fs,arguments);};}
   require('./service/wallpaper_receiver.js');`;
  child=cp.spawn(NODE12,['-e',boot],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let text='';
  child.stdout.on('data',buf=>{text+=buf.toString();
   if(text.includes('WALLPAPER_RECEIVER_READY'))resolve();});
  child.stderr.on('data',buf=>{text+=buf.toString();});
  child.once('error',reject);
  child.once('exit',code=>{if(!text.includes('WALLPAPER_RECEIVER_READY'))reject(Error('NODE12_EARLY_EXIT '+code+' '+text));});
  setTimeout(()=>{if(!text.includes('WALLPAPER_RECEIVER_READY'))reject(Error('NODE12_START_TIMEOUT '+text));},12000);
 });
}
async function stop(){if(child){const p=child;child=null;p.kill();await new Promise(ok=>p.once('exit',ok));}}
function call(method,url,body,extra={}){
 return new Promise((resolve,reject)=>{
  let headers={...extra};if(body)headers['Content-Length']=String(body.length);
  const r=http.request({hostname:'127.0.0.1',port,path:url,method,headers},res=>{
   const a=[];res.on('data',b=>a.push(b));res.on('end',()=>{
    const raw=Buffer.concat(a).toString();let obj;try{obj=JSON.parse(raw)}catch(e){obj=raw}
    resolve({status:res.statusCode,body:obj});});
  });r.on('error',reject);if(body)r.write(body);r.end();
 });
}
(async()=>{
 const tv={'X-TV-Launcher':'1','X-TV-Control-Token':ctl};
 try{
  assert.equal(cp.execFileSync(NODE12,['--version'],{encoding:'utf8'}).trim(),'v12.21.0');
  console.log('NODE12_REAL_EXECUTABLE_VERSION_PASS');
  for(const f of ['service/index.js','service/wallpaper_receiver.js','service/phone.js']){
   cp.execFileSync(NODE12,['--check',path.join(root,f)]);
   console.log('NODE12_SYNTAX_PASS',f);
  }
  await start(true);
  const health=await call('GET','/tv/health',null,tv);
  assert.equal(health.status,200);assert.equal(health.body.version,'3.3.2');
  const p=await call('POST','/tv/pair',null,tv);assert.equal(p.status,200);
  const upload=await call('POST','/upload?t='+p.body.token,jpg,{
   Origin:'http://127.0.0.1:'+port,'Content-Type':'image/jpeg','X-Pair-Code':p.body.code});
  assert.equal(upload.status,200,JSON.stringify(upload.body));
  const id=upload.body.pending;
  assert.equal((await call('POST','/tv/apply?t='+p.body.token,null,tv)).status,200);
  const saved=path.join(dir,'photos',id+'.jpg');assert(fs.existsSync(saved));
  const fail=await call('POST','/tv/delete-all',null,tv);
  assert.equal(fail.status,500);
  assert.equal((await call('GET','/tv/active',null,tv)).body.photos.length,1);
  assert(fs.existsSync(saved));console.log('NODE12_DELETE_ALL_FAILURE_DATA_PRESERVED_PASS');
  await stop();
  await start(false);
  const ok=await call('POST','/tv/delete-all',null,tv);
  assert.equal(ok.status,200,JSON.stringify(ok.body));
  assert(!fs.existsSync(saved));
  assert.equal((await call('GET','/tv/active',null,tv)).body.photos.length,0);
  console.log('NODE12_RESTART_RETRY_PHYSICAL_DELETE_PASS');
  console.log('NODE12_HOST_ISOLATED_RUNTIME_PASS_NOT_TV_ATTESTATION');
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error('NODE12_TEST_FAILED',e.stack);process.exitCode=2;});
