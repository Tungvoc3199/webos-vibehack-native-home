/* TV Home V2: local offline UI, one registry, one banner renderer.
   No app uninstall privilege, no root access or native Home modifications. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var apps = (window.V2_CATALOG || []).slice();
  var byId = {};
  apps.forEach(function (a) { byId[a.id] = a; });
  var STORE = 'tvhome.v2.preferences';
  var WALLPAPER = 'tvhome.wallpaper.choice';
  var LEGACY_FAV = ['youtube.leanback.v4','com.vtvgotv.app','com.fpt.fptplay','vieplay.vn'];
  var EXTRA_FAV = ['youtube.leanback.v4.webos22','netflix','com.viettel.media.tv360','com.apple.appletv','com.webos.app.browser','com.mytvb2c.app'];
  var DEFAULT_FAV = LEGACY_FAV.concat(EXTRA_FAV);
  var MAX_FAV = 10;
  var pref = {schema:2,favorites:DEFAULT_FAV.slice(),hidden:[],dim:58};
  var saved;
  try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
  if (saved && saved.schema === 2 && Array.isArray(saved.favorites) && Array.isArray(saved.hidden)) {
    pref.favorites = saved.favorites.filter(function (id, i, a) { return !!byId[id] && a.indexOf(id) === i; }).slice(0,MAX_FAV);
    pref.hidden = saved.hidden.filter(function (id) { return !!byId[id]; });
    pref.dim = Math.max(25,Math.min(78,Number(saved.dim) || 58));
    // One-way in-memory extension only for unchanged original four favorites.
    // Do not rewrite the user's saved preferences, or touch custom pin ordering.
    if (pref.favorites.length===LEGACY_FAV.length &&
        LEGACY_FAV.every(function(id,i){return pref.favorites[i]===id;})) {
      EXTRA_FAV.forEach(function(id){
        if (byId[id] && pref.hidden.indexOf(id)<0 && pref.favorites.indexOf(id)<0 && pref.favorites.length<MAX_FAV) {
          pref.favorites.push(id);
        }
      });
    }
  }
  var zone = 'home', libOpen = false, index = 0, navIndex = 0;
  var dialogItems = [], dialogIndex = 0, lastZone = 'home';
  var dialogType = '', dialogApp = null, okDown = false, okTimer = null;
  var holdFired = false;
  var dockReorder = null; // {id, original} until confirmed with OK; no persistent writes mid-move.
  var nav = Array.prototype.slice.call(document.querySelectorAll('.navbtn'));
  var homeTiles = [], libraryTiles = [], dockHover=-1, dockPointerX=null, dockFrame=0;
  var dockReduceMotion=!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var inputs = (window.TV_APPS && window.TV_APPS.inputs) || [];
  var searchQuery = '';
  function store() {
    try { localStorage.setItem(STORE,JSON.stringify(pref)); }
    catch (e) { toast('Không lưu được thiết lập vào bộ nhớ TV'); }
  }
  function toast(s) {
    var el = $('toast'); el.textContent = s;el.classList.add('shown');
    clearTimeout(toast.timer);
    toast.timer=setTimeout(function () { el.classList.remove('shown'); },2300);
  }
  function updatePhoto() {
    var choice='preset:aurora_lake';
    try { choice=localStorage.getItem(WALLPAPER) || choice; } catch (e) {}
    var matched=(window.TVHOME_PRESETS||[]).filter(function(x){return choice==='preset:'+x.id;})[0];
    var builtin=(window.TVHOME_PRESETS||[]).filter(function(x){return x.id===window.TVHOME_DEFAULT_PRESET;})[0];
    var builtinUrl=matched ? matched.file : builtin ? builtin.file : '';
    $('wallpaper').style.backgroundImage = choice === 'night' ?
      'linear-gradient(125deg,#0c1931,#12243d,#060914)' :
      choice === 'warm' ? 'linear-gradient(135deg,#352d2a,#615047,#161b21)' :
      choice === 'default' ? 'linear-gradient(140deg,#162032,#1d2634)' :
      builtinUrl ? 'url("'+builtinUrl+'")' : 'linear-gradient(145deg,#07213d,#182b50,#050816)';
    var d=pref.dim/100;
    $('shade').style.background='linear-gradient(180deg,rgba(3,9,20,'+Math.min(.88,d+.14)+') 0%,'+
      'rgba(3,9,20,'+(d*.34)+') 30%,rgba(3,9,20,.04) 48%,'+
      'rgba(3,9,20,'+(d*.36)+') 67%,rgba(3,9,20,'+Math.min(.93,d+.22)+') 100%)';
  }
  function clock() {
    var d=new Date(),h=d.getHours();
    $('greeting').textContent=h<11?'CHÀO BUỔI SÁNG':h<18?'CHÀO BUỔI CHIỀU':'CHÀO BUỔI TỐI';
    $('clock').textContent=('0'+h).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    $('date').textContent=d.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'long'});
  }
  function div(c,text) {
    var e=document.createElement('div');e.className=c;
    if (text !== undefined)e.textContent=text;
    return e;
  }
  function tile(a,allApp) {
    var el=div('tile'),face=div('tile-image'),img=document.createElement('img');
    el.dataset.id=a?a.id:'__library__';
    if (a) {
      if(a.id==='youtube.leanback.v4.webos22'){
        face.classList.add('yt-adfree-face');
        face.appendChild(div('yt-adfree-play','▶'));
        face.appendChild(div('yt-adfree-word','YouTube'));
        face.appendChild(div('yt-adfree-tag','ADFREE'));
      }else{
        img.src=allApp?(a.banner||a.icon):('dock-icons/'+a.id+'.png');img.alt=a.title;
        img.onerror=function () { if (img.src.indexOf(a.icon)===-1)img.src=a.icon; };
        face.appendChild(img);
      }
      if (pref.hidden.indexOf(a.id)>=0) {
        el.classList.add('tile-hidden');
        face.appendChild(div('tile-flag','Đã ẩn khỏi Home'));
      }
    } else {
      face.classList.add('tile-library');
      face.appendChild(div('library-icon','⊞'));
    }
    var dockTitle=a?(allApp?a.title:(a.id==='com.vtvgotv.app'?'VTV Go':a.title)):'Ứng dụng';
    el.appendChild(face);el.appendChild(div('tile-title',dockTitle));
    el.addEventListener('click',function () {
      if (zone==='modal')return;
      if (dockReorder)return; // No accidental app launches while carrying a Dock icon.
      if (!a)openLibrary();
      else launch(a.id,a.title);
    });
    el.addEventListener('contextmenu',function (e) {
      e.preventDefault();if(a)openAppMenu(a);
    });
    // TV pointer long press is optional; remote OK long-press is primary.
    return el;
  }
  function renderHome() {
    var root=$('favoriteItems');root.textContent='';
    homeTiles=[];
    pref.favorites.forEach(function (id) {
      if (!byId[id] || pref.hidden.indexOf(id)>=0)return;
      var el=tile(byId[id]);root.appendChild(el);homeTiles.push(el);
    });
    var all=tile(null);root.appendChild(all);homeTiles.push(all);
    if (!homeTiles.length) return;
    index=Math.min(index,homeTiles.length-1);
    homeTiles.forEach(function(el,i){
      el.addEventListener('mouseenter',function(){dockHover=i;applyDockWave();});
      el.addEventListener('mouseleave',function(){
        if(dockHover===i){dockHover=-1;applyDockWave();}
      });
    });
    if (zone==='home')focus();
    highlightDockReorder();
  }
  function renderLibrary() {
    var root=$('appGrid');root.textContent='';libraryTiles=[];
    apps.filter(function (a) {
      var text=(a.title+' '+a.id).toLocaleLowerCase('vi');
      return !searchQuery || text.indexOf(searchQuery)>=0;
    }).forEach(function (a) {
      var el=tile(a,true);root.appendChild(el);libraryTiles.push(el);
    });
    $('catalogNote').textContent='Danh sách ứng dụng từ bản đồng bộ gần nhất · '+libraryTiles.length+' / '+apps.length+
      ' mục · Ẩn khỏi Home không phải gỡ khỏi TV';
    if (zone==='library')focus();
  }
  function focusedApp() {
    if (zone==='home') return byId[(homeTiles[index]||{}).dataset && homeTiles[index].dataset.id];
    if (zone==='library') return byId[(libraryTiles[index]||{}).dataset && libraryTiles[index].dataset.id];
    return null;
  }
  // Keep the physical hit boxes fixed for Magic Remote and keyboard safety.
  // Magnify via transform only — no relayout on each focus step or mouse move.
  function applyDockWave() {
    if(dockReduceMotion){
      var panel=$('favorites');
      if(panel)panel.classList.toggle('dock-pointer-active',dockHover>=0);
      homeTiles.forEach(function(el,i){
        el.classList.toggle('dock-hovered',dockHover===i);
        el.style.setProperty('--dock-wave-scale','1');
        el.style.setProperty('--dock-wave-x','0px');
        el.style.setProperty('--dock-wave-y','0px');
        el.style.zIndex='1';
      });
      return;
    }
    var active=dockHover>=0 ? dockHover : zone==='home' ? index : -1;
    var fractional=active;
    // Cursor-proximity wave (smooth cosine falloff); TV arrows stay index based.
    // Read only two fixed tile bounds; never relayout the strip while animating.
    if(dockPointerX!==null && homeTiles.length>1){
      var first=homeTiles[0].getBoundingClientRect();
      var second=homeTiles[1].getBoundingClientRect();
      var pitch=second.left-first.left;
      if(pitch>0)fractional=(dockPointerX-first.left-first.width/2)/pitch;
    }
    var slab=$('favorites');
    if(slab)slab.classList.toggle('dock-pointer-active',dockHover>=0);
    homeTiles.forEach(function(el,i){
      el.classList.toggle('dock-hovered',dockHover===i);
      var dist=Math.abs(i-fractional), scale, push;
      if(dockPointerX!==null && pitch>0){
        var influence=Math.max(0,Math.cos(Math.min(1,dist/2.25)*Math.PI/2));
        scale=1+0.23*influence*influence;
        push=13*Math.max(0,1-dist/2.4);
      }else{
        scale=active<0?1:dist===0?1.23:dist===1?1.105:dist===2?1.035:1;
        push=dist===1?12:dist===2?7:0;
      }
      var dx=active<0?0:i<fractional?-push:i>fractional?push:0;
      var dy=-Math.round((scale-1)*38);
      el.style.setProperty('--dock-wave-scale',scale.toFixed(4));
      el.style.setProperty('--dock-wave-x',dx.toFixed(1)+'px');
      el.style.setProperty('--dock-wave-y',dy+'px');
      el.style.zIndex=dist<.6?'7':dist<1.6?'5':dist<2.6?'3':'1';
    });
  }
  function focus() {
    nav.forEach(function(e){e.classList.remove('focused');});
    homeTiles.concat(libraryTiles).forEach(function(e){e.classList.remove('focused');});
    document.querySelector('.close-library').classList.remove('focused');
    Array.prototype.forEach.call(document.querySelectorAll('.dialog-action'),function(e){e.classList.remove('focused');});
    var el;
    if (zone==='top') el=nav[navIndex];
    if (zone==='home') el=homeTiles[index];
    if (zone==='library') el=libraryTiles[index];
    if (zone==='search')el=$('appSearch');
    if (zone==='modal') el=document.querySelectorAll('.dialog-action')[dialogIndex];
    if (el) {el.classList.add('focused');if(zone==='library')el.scrollIntoView({block:'nearest',behavior:'auto'});}
    applyDockWave();
    highlightDockReorder();
  }
  function openLibrary() {
    libOpen=true;$('library').classList.remove('hidden');
    searchQuery='';if($('appSearch'))$('appSearch').value='';
    zone='library';index=0;renderLibrary();focus();
  }
  function closeLibrary() {
    libOpen=false;$('library').classList.add('hidden');
    zone='home';index=0;focus();
  }
  function showDialog(title,description,choices,type) {
    lastZone=zone;zone='modal';dialogType=type;
    $('dialogTitle').textContent=title;
    $('dialogDesc').textContent=description||'';
    var list=$('dialogActions');list.textContent='';
    dialogItems=choices;dialogIndex=0;
    choices.forEach(function (c,j) {
      var btn=document.createElement('button');btn.type='button';
      btn.className='dialog-action';btn.textContent=c.label;
      btn.disabled=!!c.disabled;
      if(c.disabled){btn.setAttribute('aria-disabled','true');}
      btn.addEventListener('mouseover',function(){if(btn.disabled)return;dialogIndex=j;focus();});
      btn.addEventListener('click',function(){if(btn.disabled)return;dialogIndex=j;activateDialog();});
      list.appendChild(btn);
    });
    $('dialogScrim').classList.remove('hidden');focus();
  }
  function closeDialog() {
    $('dialogScrim').classList.add('hidden');zone=lastZone;
    dialogItems=[];dialogType='';dialogApp=null;
    if(zone==='library')renderLibrary();else renderHome();
    focus();
  }
  function openAppMenu(a) {
    dialogApp=a;
    var fav=pref.favorites.indexOf(a.id)>=0;
    var hidden=pref.hidden.indexOf(a.id)>=0;
    var choices=[
      {label:'Mở '+a.title,act:'open'},
      {label:fav?'Bỏ ghim khỏi Home':'Ghim ra Home',act:'pin'},
      {label:'Sắp xếp icon trên Dock (← →, OK để lưu)',act:'move-dock',disabled:!fav},
      {label:hidden?'Hiện lại trên Home':'Ẩn khỏi Home',act:'hide'},
      {label:'Thông tin và hướng dẫn gỡ ứng dụng',act:'uninstall-help'},
      {label:'Đóng',act:'close'}];
    showDialog(a.title,'Quản lý ứng dụng · việc ẩn icon không xóa ứng dụng khỏi TV',
      choices,'app');
  }
  function openSettings() {
    showDialog('Cài đặt TV Home',
      'Quản lý ứng dụng, hình nền và chế độ hiển thị',
      [{label:'Kho hình nền có sẵn',act:'wallpaper-v31'},
       {label:'Gửi ảnh từ điện thoại / máy tính bảng',act:'wallpaper-v31'},
       {label:'Nền tối Midnight',act:'night'},
       {label:'Nền tối Warm Slate',act:'warm'},
       {label:'Tăng độ tương phản ảnh nền',act:'dim-up'},
       {label:'Giảm độ tối ảnh nền',act:'dim-down'},
       {label:'Thư viện & quản lý ứng dụng',act:'library'},
       {label:'Đặt lại bố cục yêu thích',act:'reset'},
       {label:'Mở cài đặt LG',act:'lg-settings'},
       {label:'Đóng',act:'close'}],'settings');
  }
  function showInputs() {
    var items=inputs.map(function(i){return {label:i.label,act:'input',appId:i.appId};});
    items.push({label:'Đóng',act:'close'});
    showDialog('Nguồn vào','Chọn cổng HDMI trên TV',items,'inputs');
  }
  function activateDialog() {
    var item=dialogItems[dialogIndex];if(!item||item.disabled)return;
    var action=item.act;
    var app=dialogApp;
    if(action==='close')return closeDialog();
    if(action==='open' && app){closeDialog();return launch(app.id,app.title);}
    if(action==='move-dock' && app) {
      closeDialog();
      startDockReorder(app);
      return;
    }
    if(action==='pin' && app) {
      var f=pref.favorites.indexOf(app.id);
      if(f>=0) pref.favorites.splice(f,1);
      else {
        if(pref.favorites.length>=MAX_FAV)return toast('Dock đã đủ ứng dụng. Hãy bỏ ghim một mục trước.');
        pref.favorites.push(app.id);
        pref.hidden=pref.hidden.filter(function(id){return id!==app.id;});
      }
      store();closeDialog();toast('Đã cập nhật Home');return;
    }
    if(action==='hide' && app){
      var h=pref.hidden.indexOf(app.id);
      if(h>=0)pref.hidden.splice(h,1);
      else {pref.hidden.push(app.id);pref.favorites=pref.favorites.filter(function(id){return id!==app.id;});}
      store();closeDialog();toast('Đã cập nhật mục ẩn');return;
    }
    if(action==='uninstall-help' && app) {
      var label=app.id==='tv.solocoo.vstv'?'K+ chưa được xác minh đã gỡ khỏi TV. ':'';
      closeDialog();
      showDialog('Gỡ ứng dụng: '+app.title,
        label+'TV Home không có quyền gỡ chương trình. Vào Home LG gốc → Chỉnh sửa danh sách ứng dụng → chọn '+app.title+
        ' → thùng rác → Xác nhận. Chỉ gỡ nếu LG cho phép; đừng xóa ứng dụng hệ thống.',
        [{label:'Đã hiểu',act:'close'}],'info');
      return;
    }
    if(action==='wallpaper-v31'){
      closeDialog();if(window.WALLPAPER_V31)window.WALLPAPER_V31.open();return;
    }
    if(action==='night'||action==='warm'){
      if(window.WALLPAPER_V31)window.WALLPAPER_V31.clearSelected();
      try{localStorage.setItem(WALLPAPER,action);}catch(e){}
      updatePhoto();closeDialog();toast('Đã đổi hình nền');return;
    }
    if(action==='dim-up'||action==='dim-down'){
      pref.dim=Math.min(78,Math.max(25,pref.dim+(action==='dim-up'?10:-10)));
      store();updatePhoto();closeDialog();toast('Độ tối: '+pref.dim+'%');return;
    }
    if(action==='reset'){
      pref.favorites=DEFAULT_FAV.slice();pref.hidden=[];pref.dim=58;
      store();updatePhoto();closeDialog();toast('Đã khôi phục bố cục');return;
    }
    if(action==='library'){closeDialog();openLibrary();return;}
    if(action==='lg-settings'){closeDialog();launch('com.palm.app.settings','Cài đặt LG');return;}
    if(action==='input'){closeDialog();launch(item.appId,item.label);return;}
  }
  var bridges=[];
  function launch(id,name){
    if(!id||id==='__library__')return;
    if(typeof PalmServiceBridge!=='function'){
      window.V2_TEST_LAUNCHES=window.V2_TEST_LAUNCHES||[];
      window.V2_TEST_LAUNCHES.push(id);toast('Xem trước: '+(name||id));return;
    }
    try{
      var bridge=new PalmServiceBridge();
      bridge.onservicecallback=function(text){
        try{if(JSON.parse(text).returnValue===false)toast('Không mở được '+name);}
        catch(e){}
        bridges=bridges.filter(function(x){return x!==bridge;});
      };
      bridges.push(bridge);
      bridge.call('luna://com.webos.applicationManager/launch',JSON.stringify({id:id}));
    }catch(e){toast('Không mở được '+name);}
  }
  function navActivate(){
    var act=nav[navIndex].dataset.nav;
    if(act==='library')openLibrary();
    else if(act==='inputs')showInputs();
    else openSettings();
  }
  function move(key){
    if(zone==='modal'){
      if(key===37||key===38)dialogIndex=(dialogIndex+dialogItems.length-1)%dialogItems.length;
      if(key===39||key===40)dialogIndex=(dialogIndex+1)%dialogItems.length;
    }else if(zone==='top'){
      if(key===37)navIndex=Math.max(0,navIndex-1);
      if(key===39)navIndex=Math.min(nav.length-1,navIndex+1);
      if(key===40){zone=libOpen?'library':'home';index=0;}
    }else if(zone==='home'){
      if(key===37)index=Math.max(0,index-1);
      if(key===39)index=Math.min(homeTiles.length-1,index+1);
      if(key===38){zone='top';navIndex=1;}
      if(key===40)openLibrary();
    }else if(zone==='search'){
      if(key===40){zone='library';index=0;}
    }else if(zone==='library'){
      if(key===38 && index<5){zone='search';index=0;focus();return;}
      if(key===37)index=Math.max(0,index-1);
      if(key===39)index=Math.min(libraryTiles.length-1,index+1);
      if(key===38)index=Math.max(0,index-5);
      if(key===40)index=Math.min(libraryTiles.length-1,index+5);
    }
    focus();
  }
  function highlightDockReorder(){
    var band=$('favorites');
    if(band)band.classList.toggle('dock-reordering',!!dockReorder);
    homeTiles.forEach(function(el){
      el.classList.toggle('dock-moving',!!dockReorder && el.dataset.id===dockReorder.id);
    });
  }
  function startDockReorder(app){
    if(!app || pref.favorites.indexOf(app.id)<0 || pref.hidden.indexOf(app.id)>=0) {
      toast('Chỉ sắp xếp ứng dụng đã ghim trên Dock');return;
    }
    if(dockReorder)return;
    // App-menu flow closes before entering movement mode.
    if(zone==='modal')closeDialog();
    if(libOpen)closeLibrary();
    zone='home';
    dockReorder={id:app.id,original:pref.favorites.slice()};
    index=homeTiles.findIndex(function(el){return el.dataset.id===app.id;});
    if(index<0){dockReorder=null;highlightDockReorder();return;}
    dockPointerX=null;dockHover=-1;
    focus();
    toast('← → Di chuyển liên tục · OK lưu · Back hủy');
  }
  function shiftDockReorder(direction){
    if(!dockReorder)return;
    var at=pref.favorites.indexOf(dockReorder.id),target=at+direction;
    if(at<0 || target<0 || target>=pref.favorites.length)return;
    var other=pref.favorites[target];
    pref.favorites[target]=dockReorder.id;
    pref.favorites[at]=other;
    dockHover=-1;dockPointerX=null;
    renderHome(); // No store() until OK commits.
    index=homeTiles.findIndex(function(el){return el.dataset.id===dockReorder.id;});
    focus();
  }
  function finishDockReorder(confirm){
    if(!dockReorder)return;
    var id=dockReorder.id;
    if(!confirm)pref.favorites=dockReorder.original.slice();
    dockReorder=null;
    if(confirm)store();
    renderHome();
    index=homeTiles.findIndex(function(el){return el.dataset.id===id;});
    if(index<0)index=0;
    focus();
    toast(confirm?'Đã lưu vị trí icon trên Dock':'Đã hủy, Dock giữ nguyên');
  }
  function clickFocused(){
    if(zone==='modal')return activateDialog();
    if(zone==='top')return navActivate();
    if(zone==='home'){
      var t=homeTiles[index];
      if(t&&t.dataset.id==='__library__')return openLibrary();
      var a=focusedApp();if(a)launch(a.id,a.title);
      return;
    }
    if(zone==='library'){var a=focusedApp();if(a)launch(a.id,a.title);}
    if(zone==='search' && $('appSearch'))$('appSearch').focus();
  }
  function returnToDockAfterRelaunch(){
    // Only app-local recovery: cannot prevent the native LG Home compositor flash.
    if(dockReorder)finishDockReorder(false);
    if(window.WALLPAPER_V31&&window.WALLPAPER_V31.isOpen())window.WALLPAPER_V31.close();
    if(zone==='modal'){
      $('dialogScrim').classList.add('hidden');
      dialogItems=[];dialogType='';dialogApp=null;
    }
    if(libOpen){libOpen=false;$('library').classList.add('hidden');}
    zone='home';index=0;dockHover=-1;dockPointerX=null;
    renderHome();focus();
  }
  var hasBeenHidden=false,lastReentryAt=0;
  function appReentry(){
    var now=Date.now();
    if(!dockReorder && now-lastReentryAt<500 && zone==='home' && !libOpen &&
       !(window.WALLPAPER_V31&&window.WALLPAPER_V31.isOpen()))return;
    lastReentryAt=now;
    returnToDockAfterRelaunch();
  }
  window.addEventListener('webOSRelaunch',appReentry);
  document.addEventListener('webOSRelaunch',appReentry);
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){hasBeenHidden=true;if(dockReorder)finishDockReorder(false);return;}
    if(hasBeenHidden){hasBeenHidden=false;appReentry();}
  });
  document.addEventListener('keydown',function(e){
    var k=e.keyCode;
    if(window.WALLPAPER_V31&&window.WALLPAPER_V31.isOpen())return;
    if([13,37,38,39,40,461,27,8].indexOf(k)<0)return;
    if(dockReorder){
      e.preventDefault();e.stopPropagation();
      if(k===37||k===39)shiftDockReorder(k===37?-1:1);
      else if(k===13 && !okDown){okDown=true;holdFired=true;finishDockReorder(true);}
      else if(k===461||k===27||k===8)finishDockReorder(false);
      return;
    }
    // On the root Home, let webOS handle Back itself. Never trap user in V2.
    if((k===461||k===27||k===8) && zone!=='modal' && !libOpen) return;
    e.preventDefault();e.stopPropagation();
    if(k===461||k===27||k===8){
      if(zone==='modal')closeDialog();
      else if(libOpen)closeLibrary();
      else {zone='home';index=0;focus();}
      return;
    }
    if(k===13){
      if(okDown)return;
      okDown=true;holdFired=false;
      if(zone==='home'||zone==='library'){
        var selected=focusedApp();
        if(selected)okTimer=setTimeout(function(){
          holdFired=true;okTimer=null;
          if(zone==='home' && pref.favorites.indexOf(selected.id)>=0)startDockReorder(selected);
          else openAppMenu(selected);
        },650);
      }
      return;
    }
    if(k===37||k===38||k===39||k===40)move(k);
  },true);
  document.addEventListener('keyup',function(e){
    if(e.keyCode!==13)return;
    e.preventDefault();e.stopPropagation();
    if(!okDown)return;
    okDown=false;clearTimeout(okTimer);okTimer=null;
    if(!holdFired)clickFocused();
  },true);
  nav.forEach(function(el,i){
    el.addEventListener('click',function(){navIndex=i;zone='top';navActivate();});
    el.addEventListener('mouseover',function(){if(zone!=='modal'){zone='top';navIndex=i;focus();}});
  });
  // Magic Remote pointer: continuous proximity update, only when it moves.
  // rAF batches high-frequency cursor events; no background animation loop.
  var dockArea=$('favoriteItems');
  dockArea.addEventListener('mousemove',function(e){
    if(dockReduceMotion)return;
    if(dockPointerX!==null && Math.abs(e.clientX-dockPointerX)<3)return;
    dockPointerX=e.clientX;
    if(!dockFrame)dockFrame=requestAnimationFrame(function(){
      dockFrame=0;applyDockWave();
    });
  });
  dockArea.addEventListener('mouseleave',function(){
    dockPointerX=null;dockHover=-1;
    applyDockWave();
  });
  document.querySelector('.close-library').addEventListener('click',closeLibrary);
  window.V2_DEBUG={
    prefs:function(){return JSON.parse(JSON.stringify(pref));},
    state:function(){return {zone:zone,libOpen:libOpen,index:index,reordering:!!dockReorder,movingId:dockReorder?dockReorder.id:null};},
    openLibrary:openLibrary,
    showSettings:openSettings,
    clickFocused:clickFocused,
    filterApps:function(query){searchQuery=String(query||'').toLocaleLowerCase('vi').trim();index=0;renderLibrary();focus();},
    visibleApps:function(){return libraryTiles.map(function(e){return e.dataset.id;});},
    relaunchHome:appReentry
  };
  clock();setInterval(clock,10000);updatePhoto();
  renderHome();renderLibrary();focus();
})();