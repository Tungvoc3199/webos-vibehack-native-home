(function(){
'use strict';
var file=document.getElementById('file'),preview=document.getElementById('preview'),status=document.getElementById('status');
var token=new URLSearchParams(location.search).get('t')||'',previewUrl='';
file.addEventListener('change',function(){
 if(previewUrl)URL.revokeObjectURL(previewUrl);
 if(!file.files[0])return;
 previewUrl=URL.createObjectURL(file.files[0]);preview.src=previewUrl;preview.hidden=false;
 status.textContent=file.files[0].name;
});
document.getElementById('send').addEventListener('click',async function(){
 var code=document.getElementById('code').value.trim();
 if(!file.files[0]||!/^[0-9]{6}$/.test(code)){
   status.textContent='Chọn ảnh và nhập mã 6 số trên TV';return;
 }
 var button=this;button.disabled=true;status.textContent='Đang chuyển ảnh sang định dạng TV...';
 try{
 var source=URL.createObjectURL(file.files[0]);var img=new Image();
 await new Promise(function(ok,bad){img.onload=ok;img.onerror=bad;img.src=source;});
 var canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
 var c=canvas.getContext('2d'),scale=Math.max(1920/img.naturalWidth,1080/img.naturalHeight);
 var w=img.naturalWidth*scale,h=img.naturalHeight*scale;
 c.drawImage(img,(1920-w)/2,(1080-h)/2,w,h);URL.revokeObjectURL(source);
 var blob=await new Promise(function(ok){canvas.toBlob(ok,'image/jpeg',.84);});
 if(!blob)throw Error('Không xử lý được ảnh');
 var endpoint=token?'/upload?t='+encodeURIComponent(token):'/manual-upload';
 var response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'image/jpeg','X-Pair-Code':code},body:blob});
 var result=await response.json();
 if(!response.ok)throw Error(result.error||'Gửi thất bại');
 status.textContent='Đã gửi ảnh thành công!\nHãy nhìn TV, chọn Áp dụng để đổi nền.';
 }catch(e){
   status.textContent=e.message==='PAIR_EXPIRED'?
   'Mã PIN/QR đã hết hạn. Trên TV chọn Nhận ảnh mới, sau đó nhập mã PIN mới. Ảnh anh chọn vẫn giữ nguyên tại đây.':
   'Không gửi được: '+e.message;
 }
 finally{button.disabled=false;}
});
})();