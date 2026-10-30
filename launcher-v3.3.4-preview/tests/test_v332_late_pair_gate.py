"""R4 P1: delayed pairing response after failed health must not display QR/PIN."""
from pathlib import Path
from playwright.sync_api import sync_playwright
APP=Path(__file__).resolve().parent/"app"
with sync_playwright() as p:
 b=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
 page=b.new_page(viewport={"width":1920,"height":1080})
 errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
 page.add_init_script("""(()=>{
 window.V31_TEST_CONTROL_TOKEN='b'.repeat(64);
 window.V31_RECEIVER_ORIGIN='http://127.0.0.1:9879';
 window.__ver='3.3.4';window.__pairs=0;
 const timer=window.setInterval;
 window.setInterval=function(fn,ms){if(ms===60000)window.__heartbeat=fn;return timer(fn,ms)};
 window.fetch=(url)=>{
  const s=String(url);
  if(s.includes('/tv/health'))return Promise.resolve({ok:true,json:async()=>({ok:true,version:window.__ver})});
  if(s.includes('/tv/pair')){window.__pairs++;return new Promise(resolve=>{window.__resolvePair=()=>resolve({ok:true,json:async()=>({ok:true,url:'http://127.0.0.1:9879/receive',manualUrl:'http://127.0.0.1:9879',code:'123456',expiresAt:Date.now()+120000,token:'a'.repeat(40)})})})}
  return Promise.resolve({ok:true,json:async()=>({ok:true,active:'',photos:[]})});
 };
 })();""")
 page.goto((APP/"index.html").as_uri())
 page.evaluate("WALLPAPER_V31.open()")
 page.wait_for_function("WALLPAPER_V31.testState().ready")
 page.get_by_role("button",name="Nhận ảnh / Quét QR hoặc nhập PIN").click()
 page.wait_for_function("window.__pairs===1")
 page.evaluate("window.__ver='3.3.1';window.__heartbeat()")
 page.wait_for_function("!WALLPAPER_V31.testState().ready")
 page.evaluate("window.__resolvePair()")
 page.wait_for_timeout(250)
 assert "PIN 123456" not in page.locator("#wallpaperPairText").inner_text()
 assert page.locator("#wallpaperQr").inner_html().strip()==""
 assert not page.evaluate("WALLPAPER_V31.testState().paired")
 print("DELAYED_PAIR_AFTER_HEALTH_MISMATCH_QR_BLOCKED_PASS",flush=True)
 assert not errors,errors
 b.close()
