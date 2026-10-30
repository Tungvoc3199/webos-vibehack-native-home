"""Private 1920x1080 Chromium UI test: photos load, previews, arrow navigation and no footer overlap."""
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent;A=R/"app"
presets=["aurora_lake","sunrise_ocean","misty_mountains","amber_teal"]
with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
    page=browser.new_page(viewport={"width":1920,"height":1080},device_scale_factor=1)
    page.add_init_script("""(()=>{
        window.V31_TEST_CONTROL_TOKEN='b'.repeat(64);
        window.V31_RECEIVER_ORIGIN='http://127.0.0.1:9879';
        window.fetch=async function(url,opts){
          var p=String(url),v={ok:true};
          if(p.includes('/tv/health'))v={ok:true,version:'3.3.3'};
          return {ok:true,status:200,json:async()=>v};
        };
    })();""")
    errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto((A/"index.html").as_uri());page.wait_for_timeout(300)
    assert page.locator("#appGrid .tile").count()==26
    page.locator('[data-nav="settings"]').click()
    page.get_by_role("button",name="Gửi ảnh từ điện thoại / máy tính bảng").click()
    page.wait_for_timeout(300)
    assert page.locator("#wallpaperManager").is_visible()
    assert page.locator(".wallpaper-preset-thumb").count()==4
    assert page.locator(".wallpaper-preset-view").is_visible()
    page.locator("#wallpaperActions button").first.hover()
    page.wait_for_timeout(80)
    for i,id in enumerate(presets):
        if i:page.keyboard.press("ArrowDown")
        page.wait_for_timeout(70)
        image=page.locator(".wallpaper-preset-large")
        assert id+".jpg" in image.get_attribute("src"),(id,image.get_attribute("src"))
        assert image.evaluate("(i)=>i.complete && i.naturalWidth===960 && i.naturalHeight===540"),id
        visible=page.locator(".wallpaper-preset-view").is_visible()
        assert visible,id
        print("NATURE_PREVIEW_LOAD_1080P_PASS",id,flush=True)
    page.keyboard.press("ArrowUp");page.keyboard.press("ArrowUp");page.keyboard.press("ArrowUp")
    page.screenshot(path=str(R/"NATURE_PICKER_1920x1080.png"),full_page=False)
    page.keyboard.press("ArrowUp")  # wraps to final item
    page.wait_for_timeout(100)
    assert page.locator(".wallpaper-action.focused").inner_text().strip()=="Đóng",page.locator(".wallpaper-action.focused").inner_text()
    assert page.locator(".wallpaper-preset-view").is_hidden()
    row=page.locator(".wallpaper-action.focused").bounding_box()
    region=page.locator(".wallpaper-manager-options").bounding_box()
    footer=page.locator("#wallpaperStatus").bounding_box()
    assert row and region and footer
    assert row["y"]>=region["y"]-2 and row["y"]+row["height"]<=region["y"]+region["height"]+2,(row,region)
    assert region["y"]+region["height"]<=footer["y"],(region,footer)
    assert page.locator(".wallpaper-manager-options").evaluate("e=>e.scrollTop")>0
    page.screenshot(path=str(R/"NATURE_PICKER_SCROLLED_1920x1080.png"),full_page=False)
    print("NO_CLIP_LAST_ROW_AND_FOOTER_PASS",flush=True)
    page.keyboard.press("Escape")
    assert page.locator("#wallpaperManager").is_hidden()
    assert not errors,errors
    print("NATURE_UI_1920x1080_REGRESSION_PASS",flush=True)
    browser.close()
