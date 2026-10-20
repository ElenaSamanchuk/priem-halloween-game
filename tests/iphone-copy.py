# ОДИН сеанс WDA на весь сценарий (новый сеанс перезапускает Safari — это и давало ложный «сброс»)
import wda, time
from PIL import Image
OUT = "/Users/elena/Projects/priem-halloween-game/screens-dev/devices/"
c = wda.USBClient("00008101-0001681A1A69003A", port=8100); s = c.session('com.apple.mobilesafari')
s.open_url("https://elenasamanchuk.github.io/priem-halloween-game/dist/debug.html?qa=cp%d" % int(time.time())); time.sleep(10)
def snap(n): c.screenshot(OUT + 'iphone-cp-' + n + '.png'); return Image.open(OUT + 'iphone-cp-' + n + '.png').convert('RGB')
def is_win(im):
    px = im.resize((112, 243)).load()
    return any(abs(px[x, y][0]-140) < 25 and abs(px[x, y][1]-65) < 25 and px[x, y][2] > 190 for x in range(112) for y in range(100, 243))
for i, (x, y) in enumerate([(48, 179), (185, 193), (250, 181), (150, 325), (215, 321), (296, 353)]):
    s.click(x, y); time.sleep(2.0)
    if is_win(snap('w')): print('победа на тапе', i); break
    print('промах', i); s.click(345, 110); time.sleep(1.0)
s.click(187, 519); time.sleep(0.7); snap('a-copy')
time.sleep(2.4); snap('b-copy-2s')
s.click(187, 472); time.sleep(0.7); snap('c-code')
s.click(187, 652); time.sleep(2.5); snap('d-share')   # «Поделиться в соцсетях» — системная шторка
