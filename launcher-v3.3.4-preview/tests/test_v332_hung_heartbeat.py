"""R3 P1: hung heartbeat may never suppress subsequent health checks or bypass pairing gate."""
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
 window.__calls=[];window.__pairs=0;
 const original=window.setInterval;
 window.setInterval=function(fn,ms){if(ms===60000)window.__tick=fn;return original(fn,ms)};
 window.fetch=(url)=>{
  if(String(url).includes('/tv/health'))return new Promise(resolve=>window.__calls.push(resolve));
  if(String(url).includes('/tv/pair'))window.__pairs++;
  return Promise.resolve({ok:true,json:async()=>({ok:true})});
 };
 window.__resolve=(i,v)=>window.__calls[i]({ok:true,json:async()=>({ok:true,version:v})});
 })();""")
 page.goto((APP/"index.html").as_uri())
 page.evaluate("WALLPAPER_V31.open()")
 page.wait_for_function("window.__calls.length===1")
 page.evaluate("window.__resolve(0,'3.3.4')")
 page.wait_for_function("WALLPAPER_V31.testState().ready")
 page.evaluate("window.__tick()")
 page.wait_for_function("window.__calls.length===2")
 # Leave old heartbeat promise unresolved forever.
 page.evaluate("WALLPAPER_V31.close();WALLPAPER_V31.open()")
 page.wait_for_function("window.__calls.length===3")
 page.evaluate("window.__resolve(2,'3.3.4')")
 page.wait_for_function("WALLPAPER_V31.testState().ready")
 page.evaluate("window.__tick()")
 page.wait_for_function("window.__calls.length===4",timeout=2000)
 page.evaluate("window.__resolve(3,'3.3.1')")
 page.wait_for_function("!WALLPAPER_V31.testState().ready")
 page.get_by_role("button",name="Nhận ảnh / Quét QR hoặc nhập PIN").click()
 assert page.evaluate("window.__pairs")==0
 print("HUNG_OLD_HEARTBEAT_CANNOT_DISABLE_LATER_HEALTH_PASS",flush=True)
 print("HUNG_HEARTBEAT_VERSION_MISMATCH_BLOCKS_QR_PASS",flush=True)
 assert not errors,errors
 b.close()
