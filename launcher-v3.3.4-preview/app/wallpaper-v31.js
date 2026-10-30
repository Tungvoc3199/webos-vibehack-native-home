/* TV Home V3.1 Wallpaper Manager. UI-only; companion is optional and fail-safe.
 * No native Home access, privileged webOS calls, or arbitrary remote writes.
 */
(function () {
'use strict';
var API=window.V31_RECEIVER_ORIGIN||'http://127.0.0.1:8765';
var CHOICE='tvhome.v31.wallpaper';
var on=false,idx=0,buttons=[],pair=null,pending=null,poll=null,ready=false,pairSeq=0;
var galleryMode=false,uiEpoch=0,confirmDelete=null,lastKeyMove=0;
var liveHeartbeat=null, healthSeq=0;
var control='';
var root=document.getElementById('wallpaperManager');
var status=document.getElementById('wallpaperStatus');
var qrTarget=document.getElementById('wallpaperQr');
var label=document.getElementById('wallpaperPairText');
var preview=document.getElementById('wallpaperPending');
var original=document.getElementById('wallpaper');
var photoPanel=document.querySelector('.wallpaper-manager-preview');
var presetPane=document.createElement('div'),presetImg=document.createElement('img'),presetCaption=document.createElement('p');
presetPane.className='wallpaper-preset-view';presetPane.hidden=true;
presetImg.alt='Xem trước phong cảnh thiên nhiên';presetImg.className='wallpaper-preset-large';
presetCaption.className='wallpaper-preset-caption';
presetPane.appendChild(presetImg);presetPane.appendChild(presetCaption);
photoPanel.appendChild(presetPane);
function previewFocused(){
 var item=choices[idx],preset=null;
 if(item&&item.key==='preset')preset=builtin.filter(function(x){return x.id===item.id;})[0];
 if(preset){
   presetImg.onload=null;presetImg.onerror=null;presetImg.hidden=false;
   presetImg.alt='Xem trước '+preset.label;
   var presetSource=preset.preview||preset.file;
   if(presetImg.getAttribute('src')!==presetSource)presetImg.src=presetSource;
   presetCaption.textContent=preset.label+' — Nhấn OK để dùng làm hình nền';
   presetPane.hidden=false;photoPanel.classList.add('has-preset-preview');
   return;
 }
 // Saved gallery: a photo is already stored on TV; a control-token-protected,
 // loopback-only GET displays it. Never download it to THADC or re-upload.
 if(galleryMode&&item&&(item.key==='select'||item.key==='delete-one')){
   presetPane.hidden=false;photoPanel.classList.add('has-preset-preview');
   presetImg.alt='Ảnh '+(item.photoIndex||'')+' đã lưu trong TV';
   var id=item.photoId||'';
   if(!/^[a-f0-9]{24}$/.test(id)||!/^[a-f0-9]{64}$/.test(control)){
     presetImg.hidden=true;
     presetCaption.textContent='Không thể xem trước: bộ nhận ảnh chưa sẵn sàng.';
     return;
   }
   var uri=API+'/photo/'+id+'.jpg?k='+encodeURIComponent(control);
   presetCaption.textContent='Đang mở ảnh '+item.photoIndex+' từ bộ nhớ TV...';
   if(presetImg.getAttribute('src')!==uri){
     presetImg.hidden=true;
     presetImg.onload=function(){
       if(!on||!galleryMode||presetImg.getAttribute('src')!==uri)return;
       presetImg.hidden=false;
       presetCaption.textContent='Ảnh '+item.photoIndex+
         (item.active?' • Đang dùng':'')+' — Nhấn OK tại Dùng ảnh để áp dụng';
     };
     presetImg.onerror=function(){
       if(!on||!galleryMode||presetImg.getAttribute('src')!==uri)return;
       presetImg.hidden=true;
       presetCaption.textContent='Không mở được ảnh xem trước. Ảnh lưu trên TV không bị thay đổi.';
     };
     presetImg.src=uri;
   }else if(presetImg.complete&&presetImg.naturalWidth){
     presetImg.hidden=false;
     presetCaption.textContent='Ảnh '+item.photoIndex+
       (item.active?' • Đang dùng':'')+' — Nhấn OK tại Dùng ảnh để áp dụng';
   }
   return;
 }
 presetImg.onload=null;presetImg.onerror=null;presetImg.hidden=true;
 if(presetImg.getAttribute('src')&&presetImg.getAttribute('src').indexOf(API+'/photo/')===0)
   presetImg.removeAttribute('src');
 presetPane.hidden=true;photoPanel.classList.remove('has-preset-preview');
}
var builtin=(window.TVHOME_PRESETS||[]);
var defaultPreset=builtin.filter(function(x){return x.id===window.TVHOME_DEFAULT_PRESET;})[0];
var defaults=builtin.map(function(x){return {label:'Nền có sẵn · '+x.label,key:'preset',id:x.id};}).concat([
 {label:'Nhận ảnh / Quét QR hoặc nhập PIN',key:'pair'},
 {label:'Áp dụng ảnh mới',key:'apply'},
 {label:'Giữ ảnh cũ / Hủy nhận ảnh',key:'discard'},
 {label:'Thư viện ảnh đã lưu trong TV',key:'gallery'},
 {label:'Xóa toàn bộ ảnh cá nhân đã lưu',key:'delete-all'},
 {label:'Đóng',key:'close'}
]);
var choices=defaults.slice();
function notify(message){status.textContent=message;}
function request(path,method){
 return fetch(API+path,{method:method||'GET',headers:{'X-TV-Launcher':'1','X-TV-Control-Token':control},
   cache:'no-store',mode:'cors'}).then(function(r){
   return r.json().then(function(j){if(!r.ok||j.ok===false)throw Error(j.error||'NO_CONNECTION');return j;});
 });
}
function startOnTv(){
 // Installed JS Service is invoked on demand, never runs as root from the UI.
 if(typeof PalmServiceBridge!=='function'){
   control=window.V31_TEST_CONTROL_TOKEN||'';
   return Promise.resolve();
 }
 return new Promise(function(resolve,reject){
   var bridge=new PalmServiceBridge(),done=false;
   var timer=setTimeout(function(){if(!done){done=true;reject(Error('SERVICE_TIMEOUT'));}},6000);
   bridge.onservicecallback=function(data){
     if(done)return;done=true;clearTimeout(timer);
     try{var response=JSON.parse(data);
       if(response.returnValue===true&&/^[a-f0-9]{64}$/.test(response.controlToken||'')){
         control=response.controlToken;resolve();
       }
       else reject(Error(response.errorText||'SERVICE_UNAVAILABLE'));
     }catch(e){reject(e);}
   };
   try{bridge.call('luna://com.gathin.tvhome.wallpaper/start','{}');}
   catch(e){if(!done){done=true;clearTimeout(timer);reject(e);}}
 });
}
function setPreset(id){
 var item=builtin.filter(function(x){return x.id===id;})[0];
 if(!item)return false;
 try{
   localStorage.setItem('tvhome.wallpaper.choice','preset:'+item.id);
   localStorage.setItem(CHOICE,'preset:'+item.id);
 }catch(e){}
 original.style.backgroundImage='url("'+item.file+'")';
 return true;
}
function clearSelected(){
 try{localStorage.setItem(CHOICE,'preset:'+window.TVHOME_DEFAULT_PRESET);}catch(e){}
}
function activateReceiver(){
 return request('/tv/active').then(function(j){
   if(!j.active)throw Error('PHOTO_NOT_AVAILABLE');
   return new Promise(function(ok,bad){
     var img=new Image(),src=API+'/photo/current.jpg?k='+encodeURIComponent(control)+'&ts='+Date.now();
     img.onload=function(){original.style.backgroundImage='url("'+src+'")';ok(true);};
     img.onerror=bad;img.src=src;
   });
 });
}
function restoreSelected(){
 var pref='preset:'+window.TVHOME_DEFAULT_PRESET,main=pref;
 try{
   pref=localStorage.getItem(CHOICE)||pref;
   main=localStorage.getItem('tvhome.wallpaper.choice')||main;
 }catch(e){}
 // Main background choice is authoritative. Never let stale V31 preference
 // override Midnight/Warm, or turn an invalid stored path into a file URL.
 if(main==='night'||main==='warm'||main==='default')return;
 if(main.indexOf('preset:')===0){
   var selected=builtin.filter(function(x){return main==='preset:'+x.id;})[0]||defaultPreset;
   if(selected)original.style.backgroundImage='url("'+selected.file+'")';
   return;
 }
 if(pref==='receiver')startOnTv().then(activateReceiver).catch(function(){
   if(defaultPreset)original.style.backgroundImage='url("'+defaultPreset.file+'")';
   // Preserve user's receiver preference if service returns after reboot.
 });
}
function renderActions(){
 var el=document.getElementById('wallpaperActions');
 el.textContent='';buttons=[];
 choices.forEach(function(choice,i){
   var b=document.createElement('button');
   b.className='wallpaper-action';b.type='button';
   if(choice.key==='preset'){
     var photo=builtin.filter(function(x){return x.id===choice.id;})[0];
     if(photo){
       var thumb=document.createElement('img');thumb.className='wallpaper-preset-thumb';
       thumb.src=(photo.thumb||photo.file);thumb.alt='';thumb.setAttribute('aria-hidden','true');
       b.appendChild(thumb);
     }
     var name=document.createElement('span');name.className='wallpaper-action-label';
     name.textContent=choice.label;b.appendChild(name);
   }else{b.textContent=choice.label;}
   b.onclick=function(){idx=i;focus();runChoice(i);};
   b.onmouseover=function(){if(Date.now()-lastKeyMove<450)return;idx=i;focus();};
   el.appendChild(b);buttons.push(b);
 });
 focus();
}
function focus(){
 buttons.forEach(function(b,i){b.classList.toggle('focused',i===idx);});
 if(buttons[idx]){
   buttons[idx].focus({preventScroll:true});
   if(buttons[idx].scrollIntoView)buttons[idx].scrollIntoView({block:'nearest'});
 }
 previewFocused();
}
function resetPair(){
 pairSeq++;
 if(poll){clearInterval(poll);poll=null;}
 pair=null;pending=null;qrTarget.textContent='';label.textContent='';
 preview.hidden=true;preview.removeAttribute('src');
}
function refreshService(){
 if(!on)return;
 // A hung previous health probe must not disable future checks.
 // Only the newest probe in the current modal epoch may change readiness.
 var turn=uiEpoch,probe=++healthSeq;
 ready=false;
 startOnTv().then(function(){return request('/tv/health');}).then(function(j){
   if(!on||uiEpoch!==turn||healthSeq!==probe)return;
   if(j.version!=='3.3.4')throw Error('RECEIVER_VERSION_MISMATCH');
   ready=true;
 }).catch(function(e){
   if(!on||uiEpoch!==turn||healthSeq!==probe)return;
   ready=false;
   // Never leave a previously issued pairing code visible after health failure.
   resetPair();
   notify(e&&e.message==='RECEIVER_VERSION_MISMATCH'?
     'Bộ nhận ảnh không khớp V3.3.4. Đã khóa tạo QR/PIN cho đến khi service được cập nhật đồng bộ.':
     'Bộ nhận ảnh tạm ngừng. Vui lòng đóng và mở lại màn hình Hình nền.');
 });
}
function open(){
 if(on)return;
 on=true;ready=false;uiEpoch++;var turn=uiEpoch,probe=++healthSeq;
 idx=0;galleryMode=false;choices=defaults.slice();root.classList.remove('hidden');document.body.classList.add('wallpaper-open');renderActions();
 // webOS JS services may idle automatically. Refresh only while this modal is shown.
 // A private LS2 request every 60s resets service idle time; no permanent daemon.
 if(liveHeartbeat)clearInterval(liveHeartbeat);
 liveHeartbeat=setInterval(refreshService,60000);
 notify('Đang kiểm tra kết nối bộ nhận ảnh trên TV...');
 startOnTv().then(function(){return request('/tv/health');}).then(function(j){
   if(!on||uiEpoch!==turn||healthSeq!==probe)return;
   if(j.version!=='3.3.4')throw Error('RECEIVER_VERSION_MISMATCH');
   ready=true;notify('Bộ nhận ảnh V3.3.4 sẵn sàng. Chọn Nhận ảnh để mở QR/IP.');
 }).catch(function(e){
   if(!on||uiEpoch!==turn||healthSeq!==probe)return;
   ready=false;
   notify(e && e.message==='RECEIVER_VERSION_MISMATCH'?
      'Bộ nhận ảnh chưa đúng phiên bản 3.3.4. Chức năng gửi ảnh đã được khóa an toàn; vẫn chọn được bốn nền có sẵn.':
      'Bộ nhận ảnh chưa hoạt động. Bạn vẫn chọn được bốn hình nền có sẵn mà không cần Internet.');
 });
}
function close(){
 if(!on)return;
 on=false;ready=false;uiEpoch++;healthSeq++;galleryMode=false;confirmDelete=null;choices=defaults.slice();
 presetImg.onload=null;presetImg.onerror=null;presetImg.removeAttribute('src');
 presetImg.hidden=true;presetPane.hidden=true;photoPanel.classList.remove('has-preset-preview');
 root.classList.add('hidden');document.body.classList.remove('wallpaper-open');
 if(liveHeartbeat){clearInterval(liveHeartbeat);liveHeartbeat=null;}
 if(poll){clearInterval(poll);poll=null;}
 resetPair();
}
function startPair(){
 if(!ready){notify('Bộ nhận ảnh chưa hoạt động trên TV. Không thể tạo mã QR lúc này.');return;}
 notify('Đang tạo mã ghép đôi bảo mật...');
 resetPair();
 var turn=uiEpoch,probe=healthSeq,requestId=pairSeq;
 request('/tv/pair','POST').then(function(j){
   if(!on||uiEpoch!==turn||healthSeq!==probe||!ready||pairSeq!==requestId)return;
   pair=j;pending=null;
   var qr=qrcode(0,'M');qr.addData(j.url);qr.make();
   qrTarget.innerHTML=qr.createSvgTag({cellSize:8,margin:14,scalable:true});
   label.textContent='PIN '+j.code+' • 15 phút • Quét QR hoặc mở '+j.manualUrl+
      ' trên trình duyệt của thiết bị cùng mạng nội bộ với TV. Ảnh chỉ được lưu sau khi Áp dụng.';
   notify('Dùng camera iPhone, Android hoặc máy tính bảng quét QR. Máy không quét được thì nhập IP TV trên trình duyệt. Nhập PIN, Gửi ảnh, rồi chọn Áp dụng trên TV.');
   poll=setInterval(checkUpload,1800);
 }).catch(function(e){if(on&&uiEpoch===turn&&healthSeq===probe&&ready&&pairSeq===requestId)notify('Không tạo được mã: '+e.message);});
}
function checkUpload(){
 if(!pair||!on)return;
 var originalPair=pair,turn=uiEpoch;
 if(Date.now()>pair.expiresAt){
   resetPair();
   notify('QR/PIN đã hết hạn và được ẩn. Chọn Nhận ảnh để tạo mã khác; ảnh nền cũ vẫn giữ nguyên.');
   return;
 }
 request('/tv/status?t='+encodeURIComponent(pair.token)).then(function(j){
   if(!on||uiEpoch!==turn||pair!==originalPair)return;
   if(j.expiresAt)pair.expiresAt=j.expiresAt;
   if(j.uploaded&&j.pending&&pending!==j.pending){
     pending=j.pending;
     preview.src=API+'/photo/'+pending+'.jpg?k='+encodeURIComponent(control)+'&v='+Date.now();
     preview.hidden=false;
     notify('Ảnh đã gửi đến TV. Chọn Áp dụng ảnh mới hoặc Hủy.');
   }
 }).catch(function(e){
   if(!on||uiEpoch!==turn||pair!==originalPair)return;
   if(e.message==='PAIR_EXPIRED'){
     resetPair();notify('QR/PIN đã hết hạn hoặc service vừa khởi động lại. Chọn Nhận ảnh để lấy mã mới.');
   }else notify('Không kiểm tra được ảnh: '+e.message);
 });
}
function apply(){
 if(!pair||!pending){notify('Chưa nhận được ảnh mới. Hãy gửi từ điện thoại, máy tính bảng hoặc máy tính trước.');return;}
 request('/tv/apply?t='+encodeURIComponent(pair.token),'POST').then(function(){
   try{
     localStorage.setItem('tvhome.wallpaper.choice','custom');
     localStorage.setItem(CHOICE,'receiver');
   }catch(e){}
   return activateReceiver();
 }).then(function(){
   notify('Đã áp dụng ảnh nền mới. Ảnh được lưu trên TV.');
   if(poll)clearInterval(poll);poll=null;
   pair=null;pending=null;qrTarget.textContent='';label.textContent='';
 }).catch(function(e){notify(e.message==='PHOTO_LIBRARY_FULL_DELETE_ONE_ON_TV'?
   'Thư viện đã đủ 5 ảnh. Hãy vào Thư viện, chọn xóa một ảnh và xác nhận trên TV, rồi chọn Áp dụng lại. Không ảnh nào tự bị xóa.':
   'Không áp dụng được ảnh: '+e.message);});
}
function discard(){
 if(!pair){notify('Không có ảnh nào đang chờ.');return;}
 request('/tv/discard?t='+encodeURIComponent(pair.token),'POST').then(function(){
   resetPair();notify('Đã hủy nhận ảnh. Ảnh cũ được giữ nguyên.');
 }).catch(function(e){notify('Không thể hủy: '+e.message);});
}
function openGallery(){
 var turn=uiEpoch;
 request('/tv/active').then(function(j){
   if(!on||uiEpoch!==turn)return;
   if(!j.photos||!j.photos.length){
     notify('Chưa có ảnh nào lưu trong thư viện TV. Ảnh chỉ được lưu khi anh chọn Áp dụng.');return;
   }
   choices=[{label:'Trở lại quản lý Hình nền',key:'back'}];
   j.photos.forEach(function(x,i){
     var safe=/^[a-f0-9]{24}$/.test(x.id||'')?x.id:'';
     choices.push({label:'Dùng ảnh '+(i+1)+(j.active===safe?' • Đang dùng':''),
       key:'select',photoId:safe,photoIndex:i+1,active:j.active===safe});
     choices.push({label:'Xóa ảnh '+(i+1),key:'delete-one',
       photoId:safe,photoIndex:i+1,active:j.active===safe});
   });
   // Focus an actual saved image, not the Back button; show its preview at once.
   galleryMode=true;idx=1;renderActions();
   notify('Ảnh đã lưu: chọn mục Dùng ảnh để xem trước; nhấn OK để áp dụng. Xóa ảnh cần xác nhận riêng.');
 }).catch(function(e){notify('Không đọc được thư viện TV: '+e.message);});
}
function runChoice(i){
 var choice=choices[i];if(!choice)return;
 var action=choice.key;
 if(confirmDelete && (!confirmDelete.key || action!=='confirm-delete'))confirmDelete=null;
 if(action==='delete-one'||action==='delete-all'){
   confirmDelete={key:action,id:choice.photoId||''};
   var msg=action==='delete-all'?'Xóa TẤT CẢ ảnh cá nhân đã lưu?':'Xóa ảnh cá nhân này khỏi TV?';
   choices=[{label:'Hủy, giữ nguyên ảnh',key:'cancel-delete'},
     {label:'XÁC NHẬN — '+msg,key:'confirm-delete'}];
   idx=0;renderActions();
   notify('Chưa xóa ảnh. Cần chọn XÁC NHẬN trên TV để thực hiện. Không thể hoàn tác.');
   return;
 }
 if(action==='cancel-delete'){confirmDelete=null;galleryMode=false;choices=defaults.slice();idx=0;renderActions();return;}
 if(action==='confirm-delete'){
   var requested=confirmDelete;
   confirmDelete=null;
   if(!requested){notify('Chưa chọn ảnh cần xóa.');return;}
   var endpoint=requested.key==='delete-all'?'/tv/delete-all':
     '/tv/delete?id='+encodeURIComponent(requested.id);
   request(endpoint,'POST').then(function(j){
     if(!j.active){
       try{localStorage.setItem('tvhome.wallpaper.choice','preset:'+window.TVHOME_DEFAULT_PRESET);
           localStorage.setItem(CHOICE,'preset:'+window.TVHOME_DEFAULT_PRESET);}catch(e){}
       if(defaultPreset)original.style.backgroundImage='url("'+defaultPreset.file+'")';
     }else if(j.active){
       return activateReceiver();
     }
   }).then(function(){
     galleryMode=false;choices=defaults.slice();idx=0;renderActions();
     notify('Đã xóa ảnh theo yêu cầu trên TV. Không ảnh hưởng nền có sẵn.');
   }).catch(function(e){notify('Xóa ảnh chưa hoàn tất: '+e.message);});
   return;
 }
 if(action==='gallery'){openGallery();return;}
 if(action==='back'){galleryMode=false;confirmDelete=null;choices=defaults.slice();idx=0;renderActions();return;}
 if(action==='select'){
   request('/tv/select?id='+encodeURIComponent(choice.photoId),'POST').then(function(){
     try{
       localStorage.setItem('tvhome.wallpaper.choice','custom');
       localStorage.setItem(CHOICE,'receiver');
     }catch(e){}
     return activateReceiver();
   }).then(function(){
     galleryMode=false;choices=defaults.slice();idx=0;renderActions();
     notify('Đã chọn ảnh đã lưu từ bộ nhớ TV, không cần tải lại.');
   }).catch(function(e){notify('Không mở được ảnh đã lưu: '+e.message);});return;
 }
 if(action==='preset'){
   if(setPreset(choice.id))notify('Đã chọn hình nền '+choice.label+'. Có sẵn trên TV, không cần Internet.');
   return;
 }
 if(action==='pair')startPair();
 if(action==='apply')apply();
 if(action==='discard')discard();
 if(action==='close')close();
}
document.addEventListener('keydown',function(e){
 if(!on)return;
 var k=e.keyCode;
 if([13,37,38,39,40,461,27,8].indexOf(k)<0)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(k===461||k===27||k===8){
   if(galleryMode){galleryMode=false;choices=defaults.slice();idx=0;renderActions();return;}
   return close();
 }
 lastKeyMove=Date.now();
 if(k===38||k===37)idx=(idx+choices.length-1)%choices.length;
 if(k===40||k===39)idx=(idx+1)%choices.length;
 focus();
},true);
document.addEventListener('keyup',function(e){
 if(!on||e.keyCode!==13)return;
 e.preventDefault();e.stopImmediatePropagation();runChoice(idx);
},true);
window.WALLPAPER_V31={open:open,close:close,isOpen:function(){return on;},
  clearSelected:clearSelected,
  testState:function(){return {open:on,ready:ready,pending:pending,paired:!!pair};}
};
restoreSelected();
})();
