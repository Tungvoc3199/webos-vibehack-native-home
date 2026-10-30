"""App-only 1920×1080 acceptance: reordering via Magic Remote context menu,
persistent preferences, distinct YouTube icon, relaunch resets modal.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parent
app=r/"app"
with sync_playwright() as p:
 b=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
 page=b.new_page(viewport={"width":1920,"height":1080},device_scale_factor=1)
 errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto((app/"index.html").as_uri())
 ids=lambda:page.locator("#favoriteItems .tile").evaluate_all("(els)=>els.filter(e=>e.dataset.id!=='__library__').map(e=>e.dataset.id)")
 start=ids()
 stock="youtube.leanback.v4";adfree="youtube.leanback.v4.webos22"
 assert start[0]==stock and start[4]==adfree,start
 ad=page.locator('#favoriteItems .tile[data-id="'+adfree+'"]')
 assert ad.count()==1
 assert ad.locator(".yt-adfree-play").inner_text()=="▶"
 assert ad.locator(".yt-adfree-word").inner_text()=="YouTube"
 assert ad.locator(".yt-adfree-tag").inner_text()=="ADFREE"
 assert ad.locator("img").count()==0
 assert page.locator("#appGrid .tile[data-id='"+adfree+"'] .yt-adfree-tag").inner_text()=="ADFREE"
 print("DUAL_YOUTUBE_DISTINCT_BADGE_ALWAYS_VISIBLE_PASS",flush=True)
 page.screenshot(path=str(r/"V330_DOCK_ADFREE_1920x1080.png"))
 # Long OK on pinned AdFree: emulate keyDown + >650ms to bring up context menu.
 page.evaluate("""() => {
   let ids=Array.from(document.querySelectorAll('#favoriteItems .tile'));
   let i=ids.findIndex(x=>x.dataset.id==='youtube.leanback.v4.webos22');
   document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:39,bubbles:false})); // ignored no longer needed
   window.V2_DEBUG.relaunchHome();
 }""")
 # Remote arrow keys move focus to AdFree; long OK opens menu.
 for _ in range(start.index(adfree)):page.keyboard.press("ArrowRight")
 page.keyboard.down("Enter");page.wait_for_timeout(720);page.keyboard.up("Enter")
 assert page.locator("#dialogScrim").is_visible()
 assert page.get_by_role("button",name="Chuyển sang trái trên Dock").count()==1
 assert page.get_by_role("button",name="Chuyển sang phải trên Dock").count()==1
 page.get_by_role("button",name="Chuyển sang trái trên Dock").click()
 after=ids()
 assert after.index(adfree)==start.index(adfree)-1,(after,start)
 assert page.evaluate("JSON.parse(localStorage.getItem('tvhome.v2.preferences')).favorites").index(adfree)==start.index(adfree)-1
 print("MAGIC_REMOTE_DOCK_SWAP_LEFT_AND_SAVE_PASS",flush=True)
 page.reload();page.wait_for_timeout(100)
 assert ids()==after,(ids(),after)
 print("DOCK_ORDER_PERSISTS_ACROSS_RELAUNCH_PASS",flush=True)
 page.evaluate("window.WALLPAPER_V31.open()")
 assert page.locator("#wallpaperManager").is_visible()
 page.evaluate("window.dispatchEvent(new Event('webOSRelaunch'))")
 assert page.locator("#wallpaperManager").is_hidden()
 assert page.evaluate("window.V2_DEBUG.state().zone")=="home"
 assert page.locator("#dialogScrim").is_hidden()
 print("HOME_REENTRY_CLOSES_WALLPAPER_MODAL_AND_FOCUSES_DOCK_PASS",flush=True)
 # From App Library, app relaunch must close it as well.
 page.evaluate("window.V2_DEBUG.openLibrary()")
 assert page.locator("#library").is_visible()
 page.evaluate("document.dispatchEvent(new Event('webOSRelaunch'))")
 assert page.locator("#library").is_hidden()
 print("HOME_REENTRY_CLOSES_APP_LIBRARY_PASS",flush=True)
 assert not errors,errors
 print("V330_UI_REGRESSION_PASS",flush=True)
 b.close()
