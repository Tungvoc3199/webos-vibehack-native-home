"""Regression for reviewer P1: health version mismatch cannot be bypassed by heartbeat."""
from pathlib import Path
from playwright.sync_api import sync_playwright
APP=Path(__file__).resolve().parent/"app"
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
 page=browser.new_page(viewport={"width":1920,"height":1080})
 page.add_init_script("""(() => {
  window.V31_TEST_CONTROL_TOKEN='b'.repeat(64);
  window.V31_RECEIVER_ORIGIN='http://127.0.0.1:9879';
  window.__healthVersion='3.3.3';window.__pairs=0;
  const old=window.setInterval;
  window.setInterval=function(fn,ms){if(ms===60000)window.__heartbeat=fn;return old(fn,ms)};
  window.fetch=async (url,opts)=>{
   let str=String(url);
   if(str.includes('/tv/health'))return {ok:true,json:async()=>({ok:true,version:window.__healthVersion})};
   if(str.includes('/tv/pair')){window.__pairs++;return {ok:true,json:async()=>({ok:true,url:'http://127.0.0.1:9879',code:'123456',expiresAt:Date.now()+600000,token:'a'.repeat(40)})};}
   return {ok:true,json:async()=>({ok:true,active:'',photos:[]})};
  };
 })();""")
 errors=[];page.on("pageerror",lambda x:errors.append(str(x)))
 page.goto((APP/"index.html").as_uri())
 page.evaluate("WALLPAPER_V31.open()")
 page.wait_for_function("WALLPAPER_V31.testState().ready",timeout=3000)
 page.evaluate("window.__healthVersion='3.3.1';window.__heartbeat()")
 page.wait_for_function("!WALLPAPER_V31.testState().ready",timeout=3000)
 assert "không khớp" in page.locator("#wallpaperStatus").inner_text()
 page.get_by_role("button",name="Nhận ảnh / Quét QR hoặc nhập PIN").click()
 assert page.evaluate("window.__pairs")==0
 print("HEARTBEAT_REJECTS_OLD_SERVICE_AND_BLOCKS_PAIR_PASS",flush=True)
 page.evaluate("window.__healthVersion='3.3.3';window.__heartbeat()")
 page.wait_for_function("WALLPAPER_V31.testState().ready",timeout=3000)
 print("HEARTBEAT_RECOVERY_WITH_MATCHING_VERSION_PASS",flush=True)
 page.evaluate("WALLPAPER_V31.close()")
 assert not page.evaluate("WALLPAPER_V31.testState().open")
 assert not errors,errors
 print("V332_HEALTH_GATE_P1_REGRESSION_PASS",flush=True)
 browser.close()
