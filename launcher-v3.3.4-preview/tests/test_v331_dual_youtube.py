from pathlib import Path
from playwright.sync_api import sync_playwright
app=Path(__file__).resolve().parent/"app"
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
 page=browser.new_page(viewport={"width":1920,"height":1080})
 errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
 page.goto((app/"index.html").as_uri())
 ids=page.evaluate("window.V2_CATALOG.map(a=>a.id)")
 assert ids.count("youtube.leanback.v4")==1,ids
 assert ids.count("youtube.leanback.v4.webos22")==1,ids
 assert len(ids)==26,ids
 assert page.evaluate("window.TV_APPS.apps.filter(a=>a.id.indexOf('youtube.leanback.v4')===0).length")==2
 favorite=page.locator("#favoriteItems .tile")
 assert favorite.count()==11,favorite.count()
 yt=page.locator('[data-id="youtube.leanback.v4"]')
 adfree=page.locator('[data-id="youtube.leanback.v4.webos22"]')
 assert yt.count()>=1 and adfree.count()>=1,(yt.count(),adfree.count())
 assert not errors,errors
 print("YOUTUBE_STOCK_AND_ADFREE_DISTINCT_DOCK_ID_PASS",flush=True)
 print("NO_REPLACE_OR_REMOVE_STOCK_YOUTUBE_PASS",flush=True)
 browser.close()
