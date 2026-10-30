"""V3.3.3 Playwright: 4 presets, Any Device instructions, owner confirmed deletion.
Real network and TV are NOT contacted; explicit fetch mocks.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
A=Path(__file__).resolve().parent/"app"
S=A.parent/"service"
assert not (A/"keyfilters-candidate.txt").exists()
presets=["aurora_lake","sunrise_ocean","misty_mountains","amber_teal"]
mock=r"""(() => {
window.V31_TEST_CONTROL_TOKEN='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
window.V31_RECEIVER_ORIGIN='http://127.0.0.1:9879';
window.__tvDeleteCalls=0;
window.__tvDeletedIds=[];
window.__photos=[
{id:'111111111111111111111111',name:'One'},
{id:'222222222222222222222222',name:'Two'}];
window.fetch=async function(url,opts){
 const p=String(url);let data={ok:true};let code=200;
 if(p.includes('/tv/health')) data={ok:true,version:'3.3.3'};
 else if(p.includes('/tv/active')) data={ok:true,active:window.__photos[0]?.id||'',photos:window.__photos};
 else if(p.includes('/tv/delete-all')) {
   window.__tvDeleteCalls++;window.__tvDeletedIds=window.__photos.map(x=>x.id);
   window.__photos=[];data={ok:true,active:'',remaining:0};
 }
 else if(p.includes('/tv/delete?id=')) {
   window.__tvDeleteCalls++;let id=new URL(p).searchParams.get('id');
   window.__photos=window.__photos.filter(x=>x.id!==id);
   window.__tvDeletedIds.push(id);
   data={ok:true,active:window.__photos[0]?.id||'',remaining:window.__photos.length};
 }
 else if(p.includes('/tv/select'))data={ok:true,active:window.__photos[0]?.id||''};
 else if(p.includes('/tv/pair'))data={ok:true,token:'a'.repeat(40),code:'123456',
   url:'http://127.0.0.1:9879/receive?t='+ 'a'.repeat(40),
   manualUrl:'http://127.0.0.1:9879/',expiresAt:Date.now()+15*60000};
 else if(p.includes('/tv/status'))data={ok:true,uploaded:false,pending:'',expiresAt:Date.now()+15*60000};
 return {ok:code<300,status:code,json:async()=>data};
};
})();"""
with sync_playwright() as p:
 b=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
 page=b.new_page(viewport={"width":1920,"height":1080})
 page.add_init_script(mock)
 page.route("http://127.0.0.1:9879/photo/current.jpg*",lambda r:r.fulfill(status=200,content_type="image/jpeg",body=(A/"wallpapers/presets/aurora_lake.jpg").read_bytes()))
 errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto((A/"index.html").as_uri())
 assert page.locator("#appGrid .tile").count()==26
 assert page.locator("#favoriteItems .tile").count()==11
 assert "aurora_lake.jpg" in page.locator("#wallpaper").evaluate("x=>x.style.backgroundImage")
 def open_settings():
  page.locator('[data-nav="settings"]').click()
  page.get_by_role("button",name="Gửi ảnh từ điện thoại / máy tính bảng").click()
  page.wait_for_timeout(130)
  assert page.locator("#wallpaperManager").is_visible()
  print("DEBUG_READY_STATUS",page.evaluate("({state:WALLPAPER_V31.testState(),label:document.getElementById(\u0027wallpaperStatus\u0027).textContent,token:!!window.V31_TEST_CONTROL_TOKEN})"),flush=True)
  page.wait_for_function("WALLPAPER_V31.testState().ready",timeout=3500)
 def back_to_settings():
  page.keyboard.press("Escape")
  assert page.locator("#wallpaperManager").is_hidden()
 for id in presets:
  open_settings()
  page.get_by_role("button",name="Nền có sẵn",exact=False).filter(has_text=id.replace("_"," ")).count() if False else None
  ix=presets.index(id)
  page.locator("#wallpaperActions button").nth(ix).click()
  assert id+".jpg" in page.locator("#wallpaper").evaluate("x=>x.style.backgroundImage"),id
  assert page.evaluate("localStorage.getItem('tvhome.wallpaper.choice')")=="preset:"+id
  back_to_settings()
  page.reload()
  assert id+".jpg" in page.locator("#wallpaper").evaluate("x=>x.style.backgroundImage")
  print("BUILTIN_PRESET_RELOAD_PASS",id,flush=True)
 open_settings()
 page.get_by_role("button",name="Nhận ảnh / Quét QR hoặc nhập PIN").click()
 page.wait_for_timeout(100)
 label=page.locator("#wallpaperPairText").inner_text()
 assert "trình duyệt" in label and "15 phút" in label
 note=page.locator("#wallpaperStatus").inner_text()
 assert "Android" in note and "iPhone" in note and "máy tính bảng" in note
 print("ANY_DEVICE_QR_IP_TEXT_PASS",flush=True)
 page.get_by_role("button",name="Thư viện ảnh đã lưu trong TV").click()
 assert page.get_by_role("button",name="Xóa ảnh 1").is_visible()
 page.get_by_role("button",name="Xóa ảnh 1").click()
 assert page.evaluate("window.__tvDeleteCalls")==0
 page.get_by_role("button",name="Hủy, giữ nguyên ảnh").click()
 assert page.evaluate("window.__tvDeleteCalls")==0
 print("EXPLICIT_DELETE_CANCEL_NO_DATA_LOSS_PASS",flush=True)
 page.get_by_role("button",name="Thư viện ảnh đã lưu trong TV").click()
 page.get_by_role("button",name="Xóa ảnh 2").click()
 page.get_by_role("button",name="XÁC NHẬN",exact=False).click()
 page.wait_for_timeout(170)
 assert page.evaluate("window.__tvDeleteCalls")==1
 assert page.evaluate("window.__photos.length")==1
 print("EXPLICIT_DELETE_ONE_PASS",flush=True)
 page.get_by_role("button",name="Xóa toàn bộ ảnh cá nhân đã lưu").click()
 assert page.evaluate("window.__tvDeleteCalls")==1
 page.get_by_role("button",name="XÁC NHẬN",exact=False).click()
 page.wait_for_timeout(170)
 assert page.evaluate("window.__tvDeleteCalls")==2
 assert page.evaluate("window.__photos.length")==0
 assert "aurora_lake.jpg" in page.locator("#wallpaper").evaluate("x=>x.style.backgroundImage")
 print("EXPLICIT_DELETE_ALL_AND_FALLBACK_PASS",flush=True)
 phone=(S/"phone.html").read_text(encoding="utf-8")
 assert "Android" in phone and "iPhone" in phone and "Chrome" in phone
 assert "192.168.x.x:8765" in phone
 assert "X-Pair-Code" in (S/"phone.js").read_text(encoding="utf-8")
 assert not errors,errors
 print("V328_ANY_DEVICE_UI_PRIVACY_OFFLINE_PASS")
 b.close()
