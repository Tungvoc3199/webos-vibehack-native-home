/* Apple TV Lite Wallpaper Receiver V3.1 (offline candidate).
 * No native Home, KeyFilters, root or boot changes.
 * Explicitly configured storage, on-TV loopback control, LAN-only single-use upload.
 */
'use strict';
var http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto'), net=require('net');
var jpeg=require('jpeg-js'); // pure-JS MIT decoder pinned to jpeg-js@0.4.4
var HOST=process.env.WALLPAPER_BIND||'127.0.0.1';
var PORT=Number(process.env.WALLPAPER_PORT||8765);
var TVIP=process.env.TV_LAN_IP||'127.0.0.1';
var DIR=process.env.TV_WALLPAPER_DATA_DIR||'';
var MAX=8*1024*1024, EXPIRE_MS=15*60*1000, APPLY_GRACE_MS=30*60*1000, MAX_PHOTOS=5, MAX_SESSIONS=3;
if(!DIR||!path.isAbsolute(DIR)||path.parse(DIR).root===DIR)throw Error('EXPLICIT_ABSOLUTE_STORAGE_DIR_REQUIRED');
if(net.isIP(TVIP)!==4||!Number.isInteger(PORT)||PORT<1024||PORT>65535)throw Error('INVALID_NETWORK_CONFIG');
// Restrict published URLs to real private LAN addresses; localhost only in explicit
// isolated test mode with loopback binding. No arbitrary public IP or hostname.
var TEST=(process.env.TV_WALLPAPER_TEST_MODE==='1'&&HOST==='127.0.0.1');
function privateIPv4(ip){
 var a=ip.split('.').map(Number);
 if(a.length!==4||a.some(function(n){return !Number.isInteger(n)||n<0||n>255;}))return false;
 return a[0]===10||(a[0]===172&&a[1]>=16&&a[1]<=31)||(a[0]===192&&a[1]===168);
}
if(!(privateIPv4(TVIP)||(TEST&&TVIP==='127.0.0.1')))throw Error('TV_PRIVATE_LAN_IP_REQUIRED');
if(!(HOST==='0.0.0.0'||HOST===TVIP||(TEST&&HOST==='127.0.0.1')))
 throw Error('RECEIVER_BIND_HOST_INVALID');
var folder=path.join(DIR,'photos'),metaPath=path.join(DIR,'wallpaper-manifest.json');
fs.mkdirSync(folder,{recursive:true,mode:0o700}); fs.chmodSync(folder,0o700);
var sessions=Object.create(null);
// TV control capability is revealed ONLY by the owning app's private LS2 service.
// Local test fixture may inject a pinned value, never when bound to a LAN address.
var CONTROL=TEST&&process.env.TV_WALLPAPER_TEST_CONTROL_TOKEN||crypto.randomBytes(32).toString('hex');
if(!/^[a-f0-9]{64}$/.test(CONTROL))throw Error('INVALID_CONTROL_CAPABILITY');
function random(n){return crypto.randomBytes(n).toString('hex');}
function localIP(ip){return ip==='::1'||ip==='127.0.0.1'||ip==='::ffff:127.0.0.1';}
function LAN(ip){
 ip=ip.replace(/^::ffff:/,'');
 var m=/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
 if(!m)return ip==='::1';var n=m.slice(1).map(Number);
 return n.every(function(x){return x>=0&&x<=255;})&&(n[0]===10||n[0]===127||
   (n[0]===192&&n[1]===168)||(n[0]===172&&n[1]>=16&&n[1]<=31));
}
function parseMeta(){
 try{var x=JSON.parse(fs.readFileSync(metaPath,'utf8'));
 if(x.schema===1&&Array.isArray(x.photos)&&typeof x.active==='string')return x;
 }catch(e){}
 return {schema:1,active:'',photos:[]};
}
var meta=parseMeta();
function atomically(file,bytes){
 var tmp=file+'.'+random(5)+'.tmp',fd=null;
 try{
  fd=fs.openSync(tmp,'wx',0o600);
  fs.writeSync(fd,bytes);fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
  fs.renameSync(tmp,file);
  // On Linux, directory fsync makes a rename durable against power loss.
  try{var parent=fs.openSync(path.dirname(file),'r');
      try{fs.fsyncSync(parent);}finally{fs.closeSync(parent);}
  }catch(e){if(process.platform!=='win32')throw e;}
 }catch(e){
  if(fd!==null)try{fs.closeSync(fd);}catch(ignore){}
  try{fs.unlinkSync(tmp);}catch(ignore){}
  throw e;
 }
}
function saveMeta(m){atomically(metaPath,Buffer.from(JSON.stringify(m),'utf8'));meta=m;}
function fileFor(id){if(!/^[a-f0-9]{24}$/.test(id))throw Error('ID_INVALID');return path.join(folder,id+'.jpg');}
function session(t){var s=sessions[t];return s&&s.expires>Date.now()?s:null;}
function cleanup(){
  var now=Date.now();
  Object.keys(sessions).forEach(function(t){if(sessions[t].expires<=now)delete sessions[t];});
  var keep=Object.create(null);
  meta.photos.forEach(function(x){if(x&&/^[a-f0-9]{24}$/.test(x.id))keep[x.id]=true;});
  Object.keys(sessions).forEach(function(t){if(sessions[t].pending)keep[sessions[t].pending]=true;});
  fs.readdirSync(folder).forEach(function(name){
    var match=/^([a-f0-9]{24})\.jpg$/.exec(name),temp=/\.tmp$/.test(name);
    if(!(temp||match&&!keep[match[1]]))return;
    try{fs.unlinkSync(path.join(folder,name));}catch(e){}
  });
}
cleanup();var sweep=setInterval(cleanup,60000);if(sweep.unref)sweep.unref();
function baseHeaders(req){
 var h={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
   'X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'"};
 if(localIP(req.socket.remoteAddress)&&
    (req.headers.origin==='null'||req.headers.origin==='file://')){
 h['Access-Control-Allow-Origin']=req.headers.origin;h['Access-Control-Allow-Headers']='X-TV-Control-Token, X-TV-Launcher, Content-Type';
 h['Access-Control-Allow-Methods']='GET, POST, OPTIONS';h['Vary']='Origin';
 }
 return h;
}
function send(req,res,code,data,type){
 var buf=Buffer.from(typeof data==='string'?data:JSON.stringify(data));
 var h=baseHeaders(req);h['Content-Type']=type||'application/json; charset=utf-8';h['Content-Length']=buf.length;
 res.writeHead(code,h);res.end(buf);
}
function fail(req,res,code,error){send(req,res,code,{ok:false,error:error});}
function checkJpeg(b){
 if(b.length<200||b.length>MAX||b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)return false;
 var pos=2,found=false;
 while(pos<b.length-7){
  if(b[pos]!==255)break;
  while(b[pos]===255)pos++;
  var marker=b[pos++];
  if(marker===218)break;
  if(marker===216||marker===1||(marker>=208&&marker<=217))continue;
  if(pos+2>b.length)return false;
  var length=b.readUInt16BE(pos);
  if(length<2||pos+length>b.length)return false;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].indexOf(marker)>=0){
    if(length<7||b.readUInt16BE(pos+3)!==1080||b.readUInt16BE(pos+5)!==1920)return false;
    found=true;
  }
  pos+=length;
 }
 if(!found)return false;
 try{
  var decoded=jpeg.decode(b,{useTArray:true,tolerantDecoding:false,
       maxResolutionInMP:3,maxMemoryUsageInMB:48});
  return decoded.width===1920&&decoded.height===1080&&
    decoded.data&&decoded.data.length===1920*1080*4;
 }catch(e){return false;}
}
function readJpeg(req,cb){
 var n=Number(req.headers['content-length']);
 if(!Number.isSafeInteger(n)||n<200||n>MAX)return cb(Error('SIZE_LIMIT'));
 var chunks=[],length=0,finished=false;
 function complete(err,data){if(finished)return;finished=true;cb(err,data);}
 req.on('data',function(c){
  length+=c.length;
  if(length>MAX){chunks=[];complete(Error('SIZE_LIMIT'));return;}
  if(!finished)chunks.push(c);
 });
 req.on('end',function(){complete(length===n?null:Error('TRUNCATED'),Buffer.concat(chunks));});
 req.on('error',function(e){complete(e);});
}
function image(req,res,id){
 var file;
 try{file=fileFor(id);var st=fs.statSync(file);if(!st.isFile())throw Error('NOT_FILE');}
 catch(e){return fail(req,res,404,'IMAGE_MISSING');}
 var h=baseHeaders(req);h['Content-Type']='image/jpeg';h['Content-Length']=st.size;
 res.writeHead(200,h);fs.createReadStream(file).pipe(res);
}
var base=__dirname;
function serveFile(req,res,name,type){
 var blob=fs.readFileSync(path.join(base,name));
 var h=baseHeaders(req);h['Content-Type']=type;h['Content-Length']=blob.length;
 res.writeHead(200,h);res.end(blob);
}
function route(req,res){
 var ip=req.socket.remoteAddress||'';
 if(!LAN(ip))return fail(req,res,403,'PRIVATE_LAN_ONLY');
 var url;
 try{url=new URL(req.url,'http://localhost');}catch(e){return fail(req,res,400,'BAD_URL');}
 var p=url.pathname,t=url.searchParams.get('t')||'';
 // Do not allow a cross-site 'simple POST' or DNS rebinding to consume PIN attempts
 // (or cancel a pairing). The TV's own LAN-upload form supplies both a fixed
 // exact Host and Origin; any invalid provenance fails BEFORE session mutation.
 if(req.method==='POST'&&(p==='/upload'||p==='/manual-upload')){
   if(req.headers.host!==TVIP+':'+PORT||
      req.headers.origin!=='http://'+TVIP+':'+PORT||
      req.headers['content-type']!=='image/jpeg')
      return fail(req,res,403,'UPLOAD_ORIGIN_OR_CONTENT_TYPE_DENIED');
 }
 var tv=p.indexOf('/tv/')===0||p.indexOf('/photo/')===0;
 if(tv&&!localIP(ip))return fail(req,res,403,'TV_LOOPBACK_ONLY');
 if(tv&&req.method!=='OPTIONS'){
  var supplied=(p.indexOf('/photo/')===0)?(url.searchParams.get('k')||''):
    String(req.headers['x-tv-control-token']||'');
  var a=Buffer.from(supplied),b=Buffer.from(CONTROL);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return fail(req,res,403,'TV_CONTROL_NOT_AUTHORIZED');
 }
 if(req.method==='OPTIONS'){
  if(!localIP(ip))return fail(req,res,403,'OPTIONS_DENIED');
  return send(req,res,204,'','text/plain');
 }
 if(req.method==='GET'&&p==='/tv/health')return send(req,res,200,{ok:true,version:'3.1-candidate'});
 if(req.method==='POST'&&p==='/tv/pair'){
  if(req.headers['x-tv-launcher']!=='1')return fail(req,res,403,'TV_HEADER_REQUIRED');
  // Do not delete pending uploads when re-opening the TV menu.
  // Preserve still-valid QR codes when a new one is made.
  // Previous implementation reset ALL sessions here and caused unexpected PAIR_EXPIRED.
  cleanup();
  var sessionKeys=Object.keys(sessions);
  // TV can close/reopen the pairing screen without invalidating its QR/PIN.
  // Also preserves a previously uploaded-but-unapplied photo for TV review.
  if(sessionKeys.length){
    var currentKey=sessionKeys[sessionKeys.length-1],current=sessions[currentKey];
    return send(req,res,200,{ok:true,token:currentKey,code:current.code,
      expiresAt:current.expires,url:'http://'+TVIP+':'+PORT+'/receive?t='+currentKey,
      manualUrl:'http://'+TVIP+':'+PORT+'/'});
  }
  if(sessionKeys.length>=MAX_SESSIONS){
    var available=sessionKeys.filter(function(k){return !sessions[k].uploaded&&!sessions[k].uploading;});
    if(!available.length)return fail(req,res,409,'FINISH_OR_DISCARD_PENDING_PHOTO');
    available.sort(function(a,b){return sessions[a].expires-sessions[b].expires;});
    delete sessions[available[0]];
  }
  // Node.js 12 on webOS 22 has no crypto.randomInt; use unbiased rejection sampling.
  var sample,ceiling=Math.floor(4294967296/900000)*900000;
  do{sample=crypto.randomBytes(4).readUInt32BE(0);}while(sample>=ceiling);
  var token=random(20),code=String(100000+(sample%900000));
  sessions[token]={expires:Date.now()+EXPIRE_MS,code:code,pending:'',uploaded:false,attempts:0};
  return send(req,res,200,{ok:true,token:token,code:code,expiresAt:sessions[token].expires,
      url:'http://'+TVIP+':'+PORT+'/receive?t='+token,
      manualUrl:'http://'+TVIP+':'+PORT+'/'});
 }
 if(req.method==='GET'&&p==='/tv/active'){
  return send(req,res,200,{ok:true,active:meta.active,photos:meta.photos});
 }
 // Recall an ALREADY-SAVED photo from TV internal storage: no phone, no QR.
 if(req.method==='POST'&&p==='/tv/select'){
  if(req.headers['x-tv-launcher']!=='1')return fail(req,res,403,'TV_HEADER_REQUIRED');
  var photoId=url.searchParams.get('id')||'';
  if(!/^[a-f0-9]{24}$/.test(photoId)||!meta.photos.some(function(x){return x.id===photoId;}))
    return fail(req,res,404,'SAVED_PHOTO_NOT_FOUND');
  if(!fs.existsSync(fileFor(photoId)))return fail(req,res,404,'SAVED_IMAGE_MISSING');
  try{saveMeta({schema:1,active:photoId,photos:meta.photos});}
  catch(e){return fail(req,res,500,'SAVE_MANIFEST_FAILED');}
  return send(req,res,200,{ok:true,active:photoId});
 }
 if(req.method==='GET'&&p==='/tv/status'){
  var s=session(t);if(!s)return fail(req,res,410,'PAIR_EXPIRED');
  return send(req,res,200,{ok:true,uploaded:s.uploaded,pending:s.pending,expiresAt:s.expires});
 }
 if(req.method==='POST'&&(p==='/tv/apply'||p==='/tv/discard')){
  if(req.headers['x-tv-launcher']!=='1')return fail(req,res,403,'TV_HEADER_REQUIRED');
  var s=session(t);if(!s)return fail(req,res,410,'PAIR_EXPIRED');
  if(p==='/tv/discard'){
   if(s.pending)try{fs.unlinkSync(fileFor(s.pending));}catch(e){}
   delete sessions[t];return send(req,res,200,{ok:true});
  }
  if(!s.uploaded||!s.pending||!fs.existsSync(fileFor(s.pending)))return fail(req,res,410,'PHOTO_NOT_READY');
  var list=[{id:s.pending,name:'Ảnh từ điện thoại'}].concat(meta.photos.filter(function(x){return x.id!==s.pending;}));
  var evicted=list.slice(MAX_PHOTOS);list=list.slice(0,MAX_PHOTOS);
  try{saveMeta({schema:1,active:s.pending,photos:list});}catch(e){return fail(req,res,500,'SAVE_MANIFEST_FAILED');}
  evicted.forEach(function(x){try{fs.unlinkSync(fileFor(x.id));}catch(e){}});
  delete sessions[t];return send(req,res,200,{ok:true,active:meta.active});
 }
 if(req.method==='GET'&&p==='/photo/current.jpg'){
  if(!meta.active)return fail(req,res,404,'NO_CUSTOM_PHOTO');
  return image(req,res,meta.active);
 }
 if(req.method==='GET'&&p.startsWith('/photo/')){
  var id=p.split('/').pop().replace(/\.jpg$/,'');
  if(meta.photos.some(function(x){return x.id===id;})||
     Object.keys(sessions).some(function(k){return !!session(k)&&sessions[k].pending===id;}))return image(req,res,id);
  return fail(req,res,404,'UNKNOWN_PHOTO');
 }
 if(req.method==='GET'&&p==='/'){
  // Stable bookmarkable LAN URL, no token required to view upload form.
  // Actual upload STILL needs current TV-displayed six-digit PIN.
  return serveFile(req,res,'phone.html','text/html; charset=utf-8');
 }
 if(req.method==='GET'&&p==='/receive'){
  if(!session(t))return fail(req,res,410,'PAIR_EXPIRED');
  return serveFile(req,res,'phone.html','text/html; charset=utf-8');
 }
 if(req.method==='GET'&&p==='/phone.js'){
  return serveFile(req,res,'phone.js','application/javascript; charset=utf-8');
 }
 if(req.method==='POST'&&(p==='/upload'||p==='/manual-upload')){
  // The stable manual URL selects the newest active pairing on this TV.
  if(p==='/manual-upload'){
    var keys=Object.keys(sessions).filter(function(k){return !!session(k);});
    t=keys.length?keys[keys.length-1]:'';
  }
  var s=session(t);if(!s)return fail(req,res,410,'PAIR_EXPIRED');
  if(s.uploaded||s.uploading)return fail(req,res,409,'ALREADY_UPLOADING_OR_UPLOADED');
  var supplied=String(req.headers['x-pair-code']||'');
  var ok=supplied.length===6&&crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(s.code));
  if(!ok){s.attempts++;
    if(s.attempts>=5)delete sessions[t];
    return fail(req,res,403,'PAIR_CODE_MISMATCH');
  }
  if(req.headers['content-type']!=='image/jpeg')return fail(req,res,415,'JPEG_ONLY');
  s.uploading=true;
  return readJpeg(req,function(err,bytes){
   s.uploading=false;
   if(err)return fail(req,res,413,'INVALID_LENGTH');
   if(!checkJpeg(bytes))return fail(req,res,415,'INVALID_1920x1080_JPEG');
   if(!session(t))return fail(req,res,410,'PAIR_EXPIRED');
   try{var id=random(12);atomically(fileFor(id),bytes);
       s.pending=id;s.uploaded=true;
       // Give the owner enough time to inspect and Apply on TV.
       s.expires=Date.now()+APPLY_GRACE_MS;
       return send(req,res,200,{ok:true,pending:id});}
   catch(e){return fail(req,res,500,'WRITE_FAILED');}
  });
 }
 return fail(req,res,404,'NOT_FOUND');
}
var server=http.createServer(route);
server.headersTimeout=12000;server.requestTimeout=18000;
server.setTimeout(20000);
server.listen(PORT,HOST,function(){console.log('WALLPAPER_RECEIVER_READY',HOST,PORT,'DATA_BOUND','NO_TV_MUTATION');});
module.exports={server:server,checkJpeg:checkJpeg,controlToken:CONTROL};