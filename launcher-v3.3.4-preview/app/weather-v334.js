/* V3.3.4 local, low-memory live weather: no privileged service, no key and no GPS.
 * Fixed selectable places, Open-Meteo https, xhr timeout, cached data honestly labeled.
 * Non-commercial personal-use integration. Never identifies actual TV address.
 */
(function(){
  'use strict';
  var KEY='tvhome.weather.location.v1',CACHE='tvhome.weather.cache.v1';
  var UPDATE_MS=20*60*1000,STALE_MS=3*60*60*1000;
  var places={
    hungyen:{name:'Hưng Yên',lat:20.64637,lon:106.05112},
    hanoi:{name:'Hà Nội',lat:21.0285,lon:105.8542},
    haiphong:{name:'Hải Phòng',lat:20.8449,lon:106.6881},
    danang:{name:'Đà Nẵng',lat:16.0544,lon:108.2022},
    hcm:{name:'TP. Hồ Chí Minh',lat:10.8231,lon:106.6297}
  };
  var $=function(id){return document.getElementById(id);};
  if(!$('weatherBox'))return;
  var selected='hungyen',lastTry=0,lastSuccess=0,active=null,generation=0;
  try {var stored=localStorage.getItem(KEY);if(places[stored])selected=stored;}catch(e){}
  function put(id,s){$(id).textContent=String(s);}
  function status(s){put('weatherUpdated',s);}
  function formatTime(ms){
    var d=new Date(ms);
    return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
  }
  function detail(code,day){
    code=Number(code);
    if(code===0)return [day?'☀':'☾','Trời quang'];
    if(code<=3)return [day?'⛅':'☁','Ít mây'];
    if(code<=48)return ['≋','Có sương mù'];
    if(code<=57)return ['☂','Mưa phùn'];
    if(code<=67)return ['☂','Có mưa'];
    if(code<=77)return ['❄','Có tuyết'];
    if(code<=82)return ['☂','Mưa rào'];
    if(code<=86)return ['❄','Tuyết rào'];
    if(code>=95)return ['⚡','Có dông'];
    return ['☁','Thời tiết biến đổi'];
  }
  function parse(obj){
    if(!obj||!obj.current)throw Error('missing-current');
    var c=obj.current,t=Number(c.temperature_2m),h=Number(c.relative_humidity_2m);
    if(!isFinite(t)||t< -70||t>65||!isFinite(h)||h<0||h>100)throw Error('invalid-weather');
    var p=null,hr=obj.hourly||{},times=hr.time||[],probs=hr.precipitation_probability||[];
    var hour=String(c.time||'').slice(0,13)+':00';
    var i=times.indexOf(hour);
    if(i>=0&&isFinite(Number(probs[i]))&&probs[i]!==null)
      p=Math.min(100,Math.max(0,Math.round(Number(probs[i]))));
    return {temp:Math.round(t),humid:Math.round(h),rain:p,code:Number(c.weather_code),day:Number(c.is_day)===1};
  }
  function render(place,values,stamp,old){
    var ico=detail(values.code,values.day);
    put('weatherCity',places[place].name);
    put('weatherIcon',ico[0]);
    put('weatherTemp',values.temp+'°');
    put('weatherSummary',ico[1]);
    put('weatherDetails','Độ ẩm '+values.humid+'% · Mưa '+(values.rain===null?'--':values.rain+'%'));
    status((old?'Dữ liệu lưu lúc ':'Cập nhật ')+formatTime(stamp)+' · Open-Meteo');
  }
  function clear(message){
    put('weatherCity',places[selected].name);put('weatherIcon','☁');
    put('weatherTemp','--°');put('weatherSummary',message);
    put('weatherDetails','Độ ẩm -- · Mưa --');status('Không có thời tiết mới');
  }
  function cached(){
    try{
      var o=JSON.parse(localStorage.getItem(CACHE));
      if(o&&o.place===selected&&Date.now()-o.at>=0&&Date.now()-o.at<=STALE_MS)
        return o;
    }catch(e){}
    return null;
  }
  function offline(){
    var o=cached();
    if(o)render(o.place,o.values,o.at,true);
    else clear('Không tải được thời tiết');
  }
  function refresh(force){
    if(document.hidden)return;
    var now=Date.now();
    if(!force && (active || now-lastTry<UPDATE_MS))return;
    if(force && active){try{active.abort();}catch(e){}active=null;}
    var run=++generation;
    lastTry=now;
    var p=places[selected],place=selected;
    var url='https://api.open-meteo.com/v1/forecast'
      +'?latitude='+encodeURIComponent(p.lat)
      +'&longitude='+encodeURIComponent(p.lon)
      +'&current=temperature_2m,relative_humidity_2m,weather_code,is_day'
      +'&hourly=precipitation_probability&forecast_days=1&timezone=Asia%2FBangkok';
    var request=new XMLHttpRequest();
    active=request;request.open('GET',url,true);request.timeout=9000;
    request.onreadystatechange=function(){
      if(request.readyState!==4 || generation!==run)return;
      active=null;
      if(request.status!==200){offline();return;}
      try{
        var values=parse(JSON.parse(request.responseText));
        var at=Date.now();lastSuccess=at;
        render(place,values,at,false);
        try{localStorage.setItem(CACHE,JSON.stringify({place:place,values:values,at:at}));}catch(e){}
      }catch(e){offline();}
    };
    request.onerror=function(){if(generation!==run)return;active=null;offline();};
    request.ontimeout=function(){if(generation!==run)return;active=null;offline();};
    try{request.send(null);}catch(e){active=null;offline();}
  }
  function setLocation(place){
    if(!places[place])return false;
    selected=place;
    try{localStorage.setItem(KEY,selected);}catch(e){}
    clear('Đang lấy thời tiết…');lastTry=0;
    refresh(true);return true;
  }
  var start=cached();
  if(start)render(start.place,start.values,start.at,true);
  else clear('Đang lấy thời tiết…');
  // Throttle to one HTTPS request per 20 minutes while Home is active.
  setTimeout(function(){refresh(false);},350);
  setInterval(function(){refresh(false);},UPDATE_MS);
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){
      ++generation;if(active){try{active.abort();}catch(e){}active=null;}
    }else refresh(false);
  });
  window.addEventListener('webOSRelaunch',function(){refresh(false);});
  window.TV_WEATHER_V334={setLocation:setLocation,refresh:refresh,
    state:function(){return {location:selected,active:!!active,lastSuccess:lastSuccess,lastTry:lastTry};}};
})();
