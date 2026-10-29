'use strict';
// Real wrapper evaluated with a mocked webos-service and receiver. No server,
// subprocess or network API is made available to the VM.
var fs=require('fs'),vm=require('vm'),assert=require('assert'),EventEmitter=require('events');
var source=fs.readFileSync(__dirname+'/service/index.js','utf8');
function fixture(){
 var handlers={},events=[],timers=[],server=new EventEmitter(),closeCallback;
 server.listening=false;
 server.close=function(cb){events.push('close');server.listening=false;closeCallback=cb;};
 var receiver={server:server,controlToken:'a'.repeat(64)};
 function Service(){this.activityManager={};this.register=function(name,handler){handlers[name]=handler;};}
 var req=function(name){
  if(name==='webos-service')return Service;
  if(name==='os')return {networkInterfaces:function(){return {eth0:[{address:'192.168.20.2',family:'IPv4',internal:false}]};}};
  if(name==='./wallpaper_receiver.js')return receiver;
  throw Error('Forbidden require: '+name);
 };
 req.cache={};req.resolve=function(x){return x;};
 vm.runInNewContext(source,{require:req,console:{error:function(){}},
  process:{env:{},exit:function(code){events.push('exit:'+code);}},
  setTimeout:function(fn,ms){var t={fn:fn,ms:ms,active:true};timers.push(t);return t;},
  clearTimeout:function(t){t.active=false;}});
 return {server:server,events:events,call:function(name){
  var replies=[];handlers[name]({respond:function(value){events.push('respond:'+name);replies.push(value);}});return replies;
 },drain:function(error){assert(closeCallback);closeCallback(error);},
 fire:function(ms){timers.filter(function(t){return t.active&&t.ms===ms;}).forEach(function(t){t.active=false;t.fn();});}};
}
function started(){var f=fixture(),r=f.call('start');f.server.listening=true;f.server.emit('listening');assert.strictEqual(r[0].returnValue,true);return f;}
var count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('idle stop responds before delayed exit',function(){var f=fixture(),r=f.call('stop');assert.strictEqual(r[0].stopped,true);assert(!f.events.includes('exit:0'));f.fire(150);assert.deepStrictEqual(f.events,['respond:stop','exit:0']);});
test('active drain responds before delayed exit',function(){var f=started(),r=f.call('stop');assert.strictEqual(r.length,0);f.drain();assert.strictEqual(r[0].stopped,true);f.fire(150);assert.strictEqual(f.events[f.events.length-1],'exit:0');});
test('start rejected throughout stopping',function(){var f=started();f.call('stop');var r=f.call('start');assert.strictEqual(r[0].returnValue,false);assert.strictEqual(r[0].errorText,'SERVICE_STOPPING');});
test('stop rejected while receiver startup is pending',function(){var f=fixture();f.call('start');var r=f.call('stop');assert.strictEqual(r[0].returnValue,false);assert.strictEqual(r[0].errorText,'SERVICE_START_PENDING');});
test('timeout never reports success and start remains blocked',function(){var f=started(),r=f.call('stop');f.fire(6500);assert.strictEqual(r[0].stopped,false);assert(!f.events.includes('exit:0'));assert.strictEqual(f.call('start')[0].errorText,'SERVICE_STOPPING');});
test('late drain exits only after close and sends no second reply',function(){var f=started(),r=f.call('stop');f.fire(6500);f.drain();assert.strictEqual(r.length,1);f.fire(150);assert.strictEqual(f.events[f.events.length-1],'exit:0');});
test('close failure never exits',function(){var f=started(),r=f.call('stop');f.drain(Error('close failed'));assert.strictEqual(r[0].returnValue,false);f.fire(150);assert(!f.events.includes('exit:0'));});
test('duplicate stop rejected without extra drain',function(){var f=started();f.call('stop');assert.strictEqual(f.call('stop')[0].returnValue,false);assert.strictEqual(f.events.filter(function(x){return x==='close';}).length,1);});
console.log('LIFECYCLE_OFFLINE_PASS '+count+' cases; VM has no filesystem or network mutation API');