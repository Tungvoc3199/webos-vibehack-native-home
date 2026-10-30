"""R2 P1 async reordered health callbacks cannot enable QR/PIN across modal epochs."""
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
 window.__healthRequests=[];window.__pairs=0;
 const interval=window.setInterval;
 window.setInterval=function(fn,ms){if(ms===60000)window.__heartbeat=fn;return interval(fn,ms)};
 window.fetch=(url,opts)=>{
  let s=String(url);
  if(s.includes('/tv/health'))return new Promise(resolve=>window.__healthRequests.push(resolve));
  if(s.includes('/tv/pair')){window.__pairs++;return Promise.resolve({ok:true,json:async()=>({ok:true})})}
  return Promise.resolve({ok:true,json:async()=>({ok:true,active:'',photos:[]})});
 };
 window.__respondHealth=(i,ver)=>window.__healthRequests[i]({ok:true,json:async()=>({ok:true,version:ver})});
 })();""")
 page.goto((APP/"index.html").as_uri())
 page.evaluate("WALLPAPER_V31.open()")
 page.wait_for_function("window.__healthRequests.length===1")
 page.evaluate("WALLPAPER_V31.close();WALLPAPER_V31.open()")
 page.wait_for_function("window.__healthRequests.length===2")
 page.evaluate("window.__respondHealth(1,'3.3.1')")
 page.wait_for_function("document.querySelector('#wallpaperStatus').textContent.includes('khóa')")
 page.evaluate("window.__respondHealth(0,'3.3.3')")
 page.wait_for_timeout(200)
 assert not page.evaluate("WALLPAPER_V31.testState().ready"),"OLD_SUCCESS_BYPASSED_NEW_FAILURE"
 page.get_by_role("button",name="Nhận ảnh / Quét QR hoặc nhập PIN").click()
 assert page.evaluate("window.__pairs")==0,"PAIR_ALLOWED_WITH_MISMATCH"
 print("R2_DELAYED_OLD_HEALTH_SUCCESS_IGNORED_PASS",flush=True)
 page.evaluate("WALLPAPER_V31.close();WALLPAPER_V31.open()")
 page.wait_for_function("window.__healthRequests.length===3")
 page.evaluate("window.__respondHealth(2,'3.3.3')")
 page.wait_for_function("WALLPAPER_V31.testState().ready")
 page.evaluate("window.__heartbeat()")
 page.wait_for_function("window.__healthRequests.length===4")
 page.evaluate("WALLPAPER_V31.close();WALLPAPER_V31.open()")
 page.wait_for_function("window.__healthRequests.length===5")
 page.evaluate("window.__respondHealth(4,'3.3.1')")
 page.wait_for_function("document.querySelector('#wallpaperStatus').textContent.includes('khóa')")
 page.evaluate("window.__respondHealth(3,'3.3.3')")
 page.wait_for_timeout(200)
 assert not page.evaluate("WALLPAPER_V31.testState().ready"),"OLD_HEARTBEAT_BYPASSED_NEW_FAILURE"
 print("R2_DELAYED_OLD_HEARTBEAT_SUCCESS_IGNORED_PASS",flush=True)
 page.evaluate("WALLPAPER_V31.close()")
 assert not page.evaluate("WALLPAPER_V31.testState().ready")
 assert not errors,errors
 print("V332_R2_OUT_OF_ORDER_EPOCH_GUARD_PASS",flush=True)
 b.close()
