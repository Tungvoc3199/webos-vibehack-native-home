"""V3.3.4 weather from mocked real-structure API, offline cache, left cleanup, TV remote."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
sample={"timezone":"Asia/Bangkok",
 "current":{"time":"2026-10-30T21:30","temperature_2m":25.4,"relative_humidity_2m":89,"weather_code":1,"is_day":0},
 "hourly":{"time":["2026-10-30T20:00","2026-10-30T21:00","2026-10-30T22:00"],
           "precipitation_probability":[8,32,40]}}
with sync_playwright() as p:
 b=p.chromium.launch(channel="chrome",headless=True,args=["--allow-file-access-from-files"])
 ctx=b.new_context(viewport={"width":1920,"height":1080})
 page=ctx.new_page()
 errors=[];requests=[]
 page.on("pageerror",lambda e:errors.append(str(e)))
 def provide(route):
  requests.append(route.request.url)
  route.fulfill(status=200,content_type="application/json",
      headers={"Access-Control-Allow-Origin":"*","Cache-Control":"no-store"},
      body=json.dumps(sample))
 page.route("https://api.open-meteo.com/**",provide)
 page.goto((R/"app/index.html").as_uri())
 page.wait_for_timeout(1100)
 assert len(requests)>=1,("API_NOT_CALLED",errors)
 assert "latitude=" in requests[0] and "longitude=" in requests[0],requests
 assert page.locator("#weatherTemp").inner_text()=="25°"
 assert page.locator("#weatherCity").inner_text()=="Hưng Yên"
 assert "89%" in page.locator("#weatherDetails").inner_text()
 assert "32%" in page.locator("#weatherDetails").inner_text()
 assert "Cập nhật" in page.locator("#weatherUpdated").inner_text()
 assert page.locator(".brandline").count()==0 and page.locator("#greeting").is_hidden()
 clock=page.locator("#clock").bounding_box()
 weather=page.locator("#weatherBox").bounding_box()
 dock=page.locator("#favorites").bounding_box()
 assert weather["y"]>clock["y"]+clock["height"] and weather["y"]+weather["height"]<dock["y"],(clock,weather,dock)
 print("WEATHER_API_DATA_CORS_LAYOUT_AND_CLEAN_LEFT_PASS",flush=True)
 # Enter Settings with TV remote and pick another place.
 page.evaluate("window.V2_DEBUG.showSettings()")
 assert page.get_by_role("button",name="Thời tiết · chọn địa phương").count()==1
 page.get_by_role("button",name="Thời tiết · chọn địa phương").click()
 page.get_by_role("button",name="Hà Nội").click()
 page.wait_for_timeout(250)
 assert page.locator("#weatherCity").inner_text()=="Hà Nội"
 assert "latitude=21.0285" in requests[-1] and "longitude=105.8542" in requests[-1]
 assert page.evaluate("window.TV_WEATHER_V334.state().location")=="hanoi"
 assert page.evaluate("localStorage.getItem('tvhome.weather.location.v1')")=="hanoi"
 print("TV_SETTINGS_LOCATION_SELECTION_PERSISTS_PASS",flush=True)
 # Reenter; no duplicated network calls on Home restart, while cache is labeled as stored.
 before=len(requests)
 page.reload();page.wait_for_timeout(1100)
 assert page.locator("#weatherCity").inner_text()=="Hà Nội"
 assert len(requests)==before+1
 print("RELOAD_ONE_REQUEST_NO_DUPLICATE_POLL_PASS",flush=True)
 # Trigger network failure and verify cached value explicitly marked as old, not live.
 page.unroute("https://api.open-meteo.com/**",provide)
 page.route("https://api.open-meteo.com/**",lambda route:route.fulfill(status=503,
    headers={"Access-Control-Allow-Origin":"*"},body="Unavailable"))
 page.evaluate("window.TV_WEATHER_V334.refresh(true)")
 page.wait_for_timeout(250)
 assert page.locator("#weatherTemp").inner_text()=="25°"
 assert "Dữ liệu lưu lúc" in page.locator("#weatherUpdated").inner_text()
 print("OFFLINE_CACHED_WEATHER_EXPLICITLY_LABELED_PASS",flush=True)
 # Stale cached value must be hidden rather than misrepresented.
 page.evaluate("""() => {const key='tvhome.weather.cache.v1';
   const v=JSON.parse(localStorage.getItem(key));v.at=Date.now()-4*3600*1000;
   localStorage.setItem(key,JSON.stringify(v));window.TV_WEATHER_V334.refresh(true);}""")
 page.wait_for_timeout(200)
 assert page.locator("#weatherTemp").inner_text()=="--°"
 print("EXPIRED_CACHE_REJECTED_NO_FAKE_REALTIME_PASS",flush=True)
 # Existing dock long-OK reorder must be untouched.
 page.keyboard.down("Enter");page.wait_for_timeout(720);page.keyboard.up("Enter")
 assert page.evaluate("window.V2_DEBUG.state().reordering") is True
 page.keyboard.press("ArrowRight")
 page.keyboard.press("Backspace")
 assert page.evaluate("window.V2_DEBUG.state().reordering") is False
 assert not errors,errors
 print("V334_DOCK_REGRESSION_AND_WEATHER_E2E_PASS",flush=True)
 b.close()
