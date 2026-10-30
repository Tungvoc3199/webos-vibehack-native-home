"""Hardware-shaped remote E2E: continuous Dock reorder, save/cancel/relaunch and launch separation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
 page=browser.new_page(viewport={"width":1920,"height":1080})
 errors=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto((R/"app/index.html").as_uri())
 ids=lambda:page.locator("#favoriteItems .tile").evaluate_all("(els)=>els.filter(x=>x.dataset.id!=='__library__').map(x=>x.dataset.id)")
 state=lambda:page.evaluate("window.V2_DEBUG.state()")
 prefs=lambda:page.evaluate("window.V2_DEBUG.prefs().favorites")
 stored=lambda:page.evaluate("JSON.parse(localStorage.getItem('tvhome.v2.preferences'))")
 before=ids()
 assert before[0]=="youtube.leanback.v4" and "youtube.leanback.v4.webos22" in before,before
 assert state()["reordering"] is False
 assert page.locator("#favorites.dock-reordering").count()==0
 initialStorage=page.evaluate("localStorage.getItem('tvhome.v2.preferences')")
 page.keyboard.down("Enter");page.wait_for_timeout(720);page.keyboard.up("Enter")
 assert state()["reordering"] and state()["movingId"]==before[0],state()
 assert page.locator("#favorites .tile.dock-moving").count()==1
 assert page.locator("#dialogScrim").is_hidden()
 print("LONG_OK_SELECTS_DIRECTLY_NO_MENU_PASS",flush=True)
 # Reorder three consecutive steps without a new OK/select per step.
 for step in range(3):
  page.keyboard.press("ArrowRight")
  assert ids().index(before[0])==step+1
  assert state()["reordering"] and state()["movingId"]==before[0]
  assert page.evaluate("localStorage.getItem('tvhome.v2.preferences')")==initialStorage
  assert not page.evaluate("window.V2_TEST_LAUNCHES || []")
 page.keyboard.press("ArrowLeft")
 assert ids().index(before[0])==2
 page.keyboard.press("ArrowUp")
 assert ids().index(before[0])==2 and state()["reordering"]
 print("CONSECUTIVE_ARROWS_NO_REPEAT_SELECT_OR_SAVE_PASS",flush=True)
 page.keyboard.press("Enter")
 after=ids()
 assert after.index(before[0])==2 and state()["reordering"] is False
 assert stored()["favorites"][:len(after)]==after
 assert not page.evaluate("window.V2_TEST_LAUNCHES || []")
 page.reload()
 assert ids()==after
 print("OK_COMMITS_ONCE_AND_PERSISTS_ACROSS_RELOAD_PASS",flush=True)
 # Cancel / Back restores exact original state; Back must not close launcher.
 newStore=page.evaluate("localStorage.getItem('tvhome.v2.preferences')")
 for _ in range(2):page.keyboard.press("ArrowRight") # choose previously moved app at slot 2
 page.keyboard.down("Enter");page.wait_for_timeout(710);page.keyboard.up("Enter")
 assert state()["reordering"]
 for _ in range(2):page.keyboard.press("ArrowLeft")
 assert ids()!=after
 page.keyboard.press("Backspace") # webOS also returns keyCode 461
 assert not state()["reordering"] and ids()==after
 assert page.evaluate("localStorage.getItem('tvhome.v2.preferences')")==newStore
 print("BACK_CANCELS_REORDER_SNAPSHOT_UNCHANGED_PASS",flush=True)
 # Remote long press on a different tile enters mode; boundaries do not wrap.
 page.keyboard.press("ArrowRight")
 active=ids()[state()["index"]]
 page.keyboard.down("Enter");page.wait_for_timeout(710);page.keyboard.up("Enter")
 assert state()["reordering"] and state()["movingId"]==active
 for _ in range(40):page.keyboard.press("ArrowLeft")
 assert ids().index(active)==0
 for _ in range(40):page.keyboard.press("ArrowRight")
 assert ids().index(active)==len(ids())-1
 page.keyboard.press("Escape")
 assert ids()==after and not state()["reordering"]
 print("BOUNDARIES_NO_WRAP_REPEAT_AND_CANCEL_PASS",flush=True)
 # Pointer context menu offers a single move-mode action (not one-off left/right).
 tile=page.locator('#favoriteItems .tile[data-id="'+active+'"]')
 tile.dispatch_event("contextmenu")
 assert page.locator("#dialogScrim").is_visible()
 menu=page.get_by_role("button",name="Sắp xếp icon trên Dock (← →, OK để lưu)")
 assert menu.count()==1 and not menu.is_disabled()
 assert page.get_by_role("button",name="Chuyển sang trái trên Dock").count()==0
 menu.click()
 assert state()["reordering"] and page.locator("#dialogScrim").is_hidden()
 page.keyboard.press("ArrowLeft")
 assert state()["reordering"]
 page.evaluate("document.dispatchEvent(new Event('webOSRelaunch'))")
 assert ids()==after and not state()["reordering"]
 print("CONTEXT_MENU_ENTER_AND_RELAUNCH_CANCEL_PASS",flush=True)
 # Short OK must still launch the normally focused app, not activate move mode.
 page.keyboard.press("Enter")
 launched=page.evaluate("window.V2_TEST_LAUNCHES || []")
 assert launched and launched[-1]==after[0],(launched,after)
 assert not state()["reordering"]
 print("SHORT_OK_STILL_LAUNCHES_APP_PASS",flush=True)
 # Version synchronization for gallery QR/PIN service.
 assert page.evaluate("document.querySelector('#favorites').className.indexOf('dock-reordering')===-1")
 import json
 a=json.loads((R/"app/appinfo.json").read_text(encoding="utf-8"))
 s=json.loads((R/"service/package.json").read_text(encoding="utf-8"))
 assert a["version"]==s["version"]=="3.3.4"
 assert "3.3.4" in (R/"app/wallpaper-v31.js").read_text(encoding="utf-8")
 assert not errors,errors
 print("V333_DOCK_REMOTE_E2E_ALL_PASS",flush=True)
 browser.close()
