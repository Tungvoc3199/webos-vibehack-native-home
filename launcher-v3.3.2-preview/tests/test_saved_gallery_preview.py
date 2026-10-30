"""Private saved-gallery 1080p regression: mock photos only; no personal photo bytes read.
Tests live service endpoint semantics via static backend source + browser UI.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
APP=ROOT/"app"
IDS=["111111111111111111111111","222222222222222222222222"]
with sync_playwright() as p:
 browser=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
 page=browser.new_page(viewport={"width":1920,"height":1080},device_scale_factor=1)
 errors=[];page.on("pageerror",lambda err:errors.append(str(err)))
 page.add_init_script("""(()=>{
   window.V31_TEST_CONTROL_TOKEN='b'.repeat(64);
   window.V31_RECEIVER_ORIGIN='http://127.0.0.1:9879';
   window.__testSelectCalls=0;
   window.__testDeleteCalls=0;
   window.fetch=async (url,opts)=>{
     let name=String(url),o={ok:true},code=200;
     if(name.includes('/tv/health'))o={ok:true,version:'3.3.2'};
     else if(name.includes('/tv/active'))o={ok:true,active:'111111111111111111111111',photos:[
       {id:'111111111111111111111111',name:'Ảnh từ điện thoại'},
       {id:'222222222222222222222222',name:'Ảnh từ điện thoại'}
     ]};
     else if(name.includes('/tv/select')){window.__testSelectCalls++;o={ok:true,active:'222222222222222222222222'};}
     else if(name.includes('/tv/delete')){window.__testDeleteCalls++;o={ok:true,active:''};}
     return {ok:code===200,status:code,json:async()=>o};
   };
 })();""")
 hits=[]
 def serve_photo(route):
  url=route.request.url
  import urllib.parse
  query=urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
  assert query.get("k")==["b"*64],"CAPABILITY_NOT_PASSED"
  assert url.split("/photo/")[-1].split(".jpg")[0] in IDS,"NOT_A_VALID_SAVED_ID"
  hits.append(url.split("/photo/")[-1].split(".jpg")[0])
  route.fulfill(status=200,content_type="image/jpeg",
    body=(APP/"wallpapers"/"previews"/"aurora_lake.jpg").read_bytes())
 page.route("http://127.0.0.1:9879/photo/*.jpg*",serve_photo)
 page.goto((APP/"index.html").as_uri())
 page.locator('[data-nav="settings"]').click()
 page.get_by_role("button",name="Kho hình nền có sẵn").click()
 page.wait_for_function("WALLPAPER_V31.testState().ready",timeout=3500)
 page.get_by_role("button",name="Thư viện ảnh đã lưu trong TV").click()
 assert page.locator("#wallpaperActions button").count()==5
 assert page.locator("#wallpaperActions button.focused").inner_text().startswith("Dùng ảnh 1")
 image=page.locator(".wallpaper-preset-large")
 page.wait_for_function("document.querySelector('.wallpaper-preset-large').complete && document.querySelector('.wallpaper-preset-large').naturalWidth>0",timeout=4000)
 assert image.is_visible()
 assert "111111111111111111111111.jpg" in image.get_attribute("src")
 assert page.locator(".wallpaper-preset-caption").is_visible()
 assert "Ảnh 1" in page.locator(".wallpaper-preset-caption").inner_text()
 assert page.evaluate("window.__testDeleteCalls")==0 and page.evaluate("window.__testSelectCalls")==0
 page.screenshot(path=str(ROOT/"V331_SAVED_GALLERY_MOCK_1920x1080.png"))
 print("SAVED_GALLERY_ACTIVE_PHOTO_VISIBLE_PASS",flush=True)
 page.keyboard.press("ArrowDown") # Delete image one
 assert "Xóa ảnh 1" in page.locator("#wallpaperActions button.focused").inner_text()
 assert image.is_visible()
 print("DELETE_ROW_SHOWS_CORRESPONDING_IMAGE_NO_MUTATION_PASS",flush=True)
 page.keyboard.press("ArrowDown") # Use image two
 page.wait_for_function("document.querySelector('.wallpaper-preset-large').complete && document.querySelector('.wallpaper-preset-large').getAttribute('src').includes('222222222222222222222222')",timeout=2000)
 assert image.is_visible()
 assert "Ảnh 2" in page.locator(".wallpaper-preset-caption").inner_text()
 assert page.evaluate("window.__testDeleteCalls")==0
 print("FOCUS_NAVIGATION_OTHER_SAVED_PHOTO_PREVIEW_PASS",flush=True)
 page.keyboard.press("ArrowDown") # Delete image two
 page.keyboard.press("Enter") # choose explicit deletion -> confirmation, not destructive
 assert page.evaluate("window.__testDeleteCalls")==0
 assert page.locator("#wallpaperActions button").count()==2
 assert "XÁC NHẬN" in page.locator("#wallpaperActions").inner_text()
 print("DELETION_NEEDS_SEPARATE_CONFIRM_NO_PHOTO_DELETED_PASS",flush=True)
 page.keyboard.press("Escape") # Goes back to defaults
 assert page.locator(".wallpaper-preset-large").is_visible() # default nature preset on return
 assert "/photo/" not in page.locator(".wallpaper-preset-large").get_attribute("src") # capability URL cleared
 assert set(hits)==set(IDS),hits
 assert not errors,errors
 print("CAPABILITY_PROTECTED_SAVED_PREVIEW_GALLERY_TEST_PASS",flush=True)
 browser.close()
