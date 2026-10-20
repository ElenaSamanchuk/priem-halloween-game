# Реальный iPhone (WDA): отладочная страница, промахи до победы, тап «Скопировать», чтение журнала с экрана
import wda, time, sys, json
U = "00008101-0001681A1A69003A"; OUT = "/Users/elena/Projects/priem-halloween-game/screens-dev/devices/"
c = wda.USBClient(U, port=8100); c.status()
s = c.session('com.apple.mobilesafari')
s.open_url("https://elenasamanchuk.github.io/priem-halloween-game/dist/debug.html?qa=dbg%d" % int(time.time())); time.sleep(9)
W, H = s.window_size(); print("окно", W, H)
def shot(n): c.screenshot(OUT + "iphone-dbg-" + n + ".png"); print("SHOT", n)
def dbg():
    e = s(className='XCUIElementTypeStaticText', labelContains='load#')
    try: return [x.label for x in e.find_elements()]
    except Exception as ex: return ['?', str(ex)[:80]]
shot("1")
def tap_label(t, timeout=4):
    el = s(labelContains=t).get(timeout=timeout); b = el.bounds; s.click(b.x + b.width / 2, b.y + b.height / 2); return b
items = ["Светильник-тыква", "Шкаф с приоткрытой дверцей", "Навесной шкафчик", "Ящик с овощами", "Котёл", "Сковорода под крышкой"]
won = False
for it in items:
    try: tap_label(it)
    except Exception as ex: print("нет", it, ex); continue
    time.sleep(1.6)
    if s(labelContains='удачливый').exists: won = True; print("победа на", it); break
    try: tap_label("Продолжить поиск"); time.sleep(0.9)
    except Exception: print("нет кнопки продолжить")
shot("2-win")
print("журнал до:", dbg())
b = tap_label("Скопировать"); print("тап Скопировать", b); time.sleep(1.2); shot("3-after-copy")
print("журнал после:", dbg())
print("попап на месте:", s(labelContains='удачливый').exists, "| кнопка:", [x.label for x in s(labelContains='Скопировано').find_elements()][:2])
