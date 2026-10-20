import wda, time
U = "00008101-0001681A1A69003A"; OUT = "/Users/elena/Projects/priem-halloween-game/screens-dev/devices/"
c = wda.USBClient(U, port=8100); s = c.session('com.apple.mobilesafari')
s.open_url("https://elenasamanchuk.github.io/priem-halloween-game/dist/debug.html?qa=dbg%d" % int(time.time())); time.sleep(10)
def shot(n): c.screenshot(OUT + "iphone-dbg-" + n + ".png"); print("SHOT", n)
items = [(48, 179), (185, 193), (250, 181), (150, 325), (215, 321), (296, 353)]
for i, (x, y) in enumerate(items):
    s.click(x, y); time.sleep(2.0)
    c.screenshot(OUT + "iphone-dbg-cur.png")
    from PIL import Image
    im = Image.open(OUT + "iphone-dbg-cur.png").convert('RGB')
    # победа: в попапе розовая плашка промокода/кнопки — ищем фиолетовую кнопку «Поделиться» (#8C41E3) в нижней половине
    px = im.resize((112, 243)).load(); win = any(abs(px[x, y][0]-140) < 25 and abs(px[x, y][1]-65) < 25 and px[x, y][2] > 190 for x in range(112) for y in range(120, 243))
    print('тап', i, 'победа' if win else 'промах')
    if win: shot("win"); break
    s.click(187, 760); time.sleep(1.0)  # тап по подложке внизу закрывает промах
