# Реальный iPhone (WDA): тапы по координатам (точки), журнал отладки сверху экрана
import wda, time
U = "00008101-0001681A1A69003A"; OUT = "/Users/elena/Projects/priem-halloween-game/screens-dev/devices/"
c = wda.USBClient(U, port=8100); s = c.session('com.apple.mobilesafari')
s.open_url("https://elenasamanchuk.github.io/priem-halloween-game/dist/debug.html?qa=dbg%d" % int(time.time())); time.sleep(10)
def shot(n): c.screenshot(OUT + "iphone-dbg-" + n + ".png"); print("SHOT", n)
items = [(48, 179), (185, 193), (250, 181), (150, 325), (215, 321), (296, 353)]
for i, (x, y) in enumerate(items):
    s.click(x, y); time.sleep(2.2); shot("tap%d" % i)
