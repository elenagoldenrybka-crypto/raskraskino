"""Делает PDF для печати: pdf/<slug>.pdf для каждой раскраски и pdf/sbornik-<подгруппа>.pdf.
Запуск: python3 tools/make_pdf.py [папка_с_png_для_svg]"""
import json, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVGPNG = sys.argv[1] if len(sys.argv) > 1 else None
pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pages = json.load(open(f"{R}/content/raskraski.json"))
sections = json.load(open(f"{R}/content/sections.json"))
OUT = f"{R}/pdf"; os.makedirs(OUT, exist_ok=True)
W, H = A4; M = 22
def img_path(p):
    if p["image"].endswith(".svg"):
        return os.path.join(SVGPNG, p["image"][:-4] + ".png") if SVGPNG else None
    return f"{R}/images/{p['image']}"
def plural(n):
    return "раскраска" if n % 10 == 1 and n % 100 != 11 else "раскраски" if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else "раскрасок"
def sheet(c, p):
    f = img_path(p)
    im = Image.open(f).convert("L"); im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).point(lambda v: 255 if v > 140 else 0).convert("1")
    c.drawImage(ImageReader(im), M, M + 14, W - 2 * M, H - 2 * M - 14, preserveAspectRatio=True, anchor="c")
    c.setFont("DV", 8); c.setFillGray(0.45)
    c.drawCentredString(W / 2, M - 6, "Раскраски бесплатно: pro-raskraski.ru")
    c.setFillGray(0); c.showPage()
def new(path, title):
    c = canvas.Canvas(path, pagesize=A4, invariant=1); c.setTitle(title); c.setAuthor("Раскраскино, pro-raskraski.ru"); return c
made = 0
for p in pages:
    if not img_path(p) or not os.path.exists(img_path(p)): continue
    c = new(f"{OUT}/{p['slug']}.pdf", p["title"]); sheet(c, p); c.save(); made += 1
for s in sections:
    for g in s["groups"]:
        lst = [p for p in pages if (p["group"] == g["slug"] or g["slug"] in p.get("also", [])) and img_path(p) and os.path.exists(img_path(p))]
        if len(lst) < 2: continue
        c = new(f"{OUT}/sbornik-{g['slug']}.pdf", f"Сборник раскрасок «{g['title']}»")
        c.setFont("DVB", 26); c.drawCentredString(W / 2, H - 160, "Сборник раскрасок")
        c.setFont("DVB", 22); c.drawCentredString(W / 2, H - 200, f"«{g['title']}»")
        c.setFont("DV", 13); c.drawCentredString(W / 2, H - 235, f"{len(lst)} {plural(len(lst))} формата А4")
        y = H - 290; c.setFont("DV", 11)
        for i, p in enumerate(lst, 1):
            if y < 90: break
            c.drawString(90, y, f"{i}. {p['title'].replace('Раскраска «', '').rstrip('»')}"); y -= 17
        c.setFont("DV", 12); c.drawCentredString(W / 2, 50, "Ещё больше бесплатных раскрасок: pro-raskraski.ru")
        c.showPage()
        for p in lst: sheet(c, p)
        c.save(); made += 1
print("PDF:", made)
