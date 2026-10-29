/* webOS TV 22 JS Service wrapper (Node 12 compatible), OFFLINE ONLY.
 * Must be packaged WITH com.gathin.tvhome. Never elevates to root.
 */
'use strict';
var Service=require('webos-service'),os=require('os');
var service=new Service('com.gathin.tvhome.wallpaper');
service.activityManager.idleTimeout=360;
var online=false,starting=false,receiverRef=null;
function resetReceiver(){
 online=false;starting=false;
 if(receiverRef&&receiverRef.server){
  try{if(receiverRef.server.listening)receiverRef.server.close();}catch(e){}
 }
 receiverRef=null;
 try{delete require.cache[require.resolve('./wallpaper_receiver.js')];}catch(e){}
}
function lanAddress(){
 var map=os.networkInterfaces(),names=Object.keys(map);
 for(var i=0;i<names.length;i++){
  var entries=map[names[i]];
  for(var j=0;j<entries.length;j++){
   var a=entries[j],ip=a.address||'';
   if(a.internal||a.family!=='IPv4')continue;
   if(/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(ip))return ip;
  }
 }
 return '';
}
service.register('start',function(message){
 if(stopping){message.respond({returnValue:false,errorText:'SERVICE_STOPPING'});return;}
 try{
  if(online&&receiverRef&&receiverRef.server.listening){
   message.respond({returnValue:true,port:8765,controlToken:receiverRef.controlToken});return;
  }
  if(online&&(!receiverRef||!receiverRef.server.listening))resetReceiver();
  if(starting){message.respond({returnValue:false,errorText:'SERVICE_START_PENDING'});return;}
  var ip=lanAddress();
  if(!ip){message.respond({returnValue:false,errorText:'TV_LAN_ADDRESS_UNAVAILABLE'});return;}
  process.env.TV_LAN_IP=ip;
  process.env.WALLPAPER_BIND='0.0.0.0';
  process.env.WALLPAPER_PORT='8765';
  process.env.TV_WALLPAPER_DATA_DIR='/media/internal/com.gathin.tvhome.wallpaper';
  starting=true;
  receiverRef=require('./wallpaper_receiver.js');
  receiverRef.server.once('listening',function(){
   starting=false;online=true;
   message.respond({returnValue:true,port:8765,controlToken:receiverRef.controlToken});
  });
  receiverRef.server.once('error',function(e){
   resetReceiver();
   message.respond({returnValue:false,errorText:'RECEIVER_BIND_ERROR'});
   console.error(e.message);
  });
 }catch(e){
  resetReceiver();
  console.error('Wallpaper receiver init failed',e.message);
  message.respond({returnValue:false,errorText:'SERVICE_START_FAILED'});
 }
});

/* Private bounded lifecycle shutdown used only by the version-gated app release
 * controller after owner-approved rollback or failed post-install attestation.
 * No process kill, no touching family photo files, native Home, boot, or keys.
 */
var stopping=false;
service.register('stop',function(message){
 if(stopping){message.respond({returnValue:false,errorText:'STOP_ALREADY_IN_PROGRESS'});return;}
 if(starting){message.respond({returnValue:false,errorText:'SERVICE_START_PENDING'});return;}
 stopping=true;
 var answered=false;
 var watchdog=null;
 function respond(ok){
  if(answered)return;
  answered=true;
  if(watchdog)clearTimeout(watchdog);
  message.respond({returnValue:ok,stopped:ok,errorText:ok?undefined:'CLOSE_TIMEOUT'});
  // A failed drain remains closed to new starts; never reopen a half-closed server.
 }
 watchdog=setTimeout(function(){respond(false);},6500);
 try{
  if(receiverRef&&receiverRef.server&&receiverRef.server.listening){
   receiverRef.server.close(function(err){
    respond(!err);
    // If the deadline already returned failure, a later completed drain can
    // still exit safely. Never send a second LS2 response or force-close sockets.
    if(!err)setTimeout(function(){process.exit(0);},150);
   });
  }else{
   respond(true);
   setTimeout(function(){process.exit(0);},150);
  }
 }catch(e){console.error('SERVICE_SAFE_STOP_FAILED',e.message);respond(false);}
});