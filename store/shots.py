import asyncio, pathlib, time, email.utils
from playwright.async_api import async_playwright

A = pathlib.Path('app/src/main/assets').resolve()
OUT = pathlib.Path('out'); OUT.mkdir(exist_ok=True)
H = [
    ("mehr", "إيران تتوج بذهبية وزن 125 كلغ في بطولة العالم للمصارعة الحرة"),
    ("irna", "تفاصيل حول رحلة الوفد الإيراني المعني بشؤون الحج إلى السعودية"),
    ("tasnim", "مصارع إيراني يفوز بالميدالية الذهبية في بطولة العالم للمصارعة الحرة في وزن 61 كلغ"),
    ("mehr", "بحرية الجيش الإيراني: اشتعال النيران في ناقلة نفط مخالفة شرق مضيق هرمز"),
    ("irna", "عراقجي: لا توجد لدينا حالياً أي خطط لعقد لقاءات مع مسؤولين أمريكيين"),
    ("tasnim", "إمام جمعة بغداد يحذر من محاولات قطع العلاقات بين بغداد وطهران"),
    ("mehr", "قائد الثورة الإسلامية: اليقظة والصمود الوطني رمز الانتصار على المعتدين"),
]

def rss(src):
    items = ''
    for i, (s, t) in enumerate(H):
        if s != src:
            continue
        d = email.utils.formatdate(time.time() - (i + 1) * 420, usegmt=True)
        items += f'<item><title>{t}</title><link>https://mubeennews.com/</link><pubDate>{d}</pubDate><description>{t}</description></item>'
    return f'<?xml version="1.0" encoding="utf-8"?><rss><channel>{items}</channel></rss>'

ICON = """<!doctype html><html dir=rtl><head><meta charset=utf-8><style>
@font-face{font-family:Cairo;src:url('FONT');font-weight:200 1000}
html,body{margin:0;width:512px;height:512px;background:#0b0b0b;overflow:hidden}
.w{width:512px;height:512px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-family:Cairo,sans-serif}
b{font-size:100px;font-weight:900;color:#fff;line-height:1.05}b span{color:#FF7A00}
</style></head><body><div class=w>
<svg width=110 height=220 viewBox="0 0 80 160"><defs><linearGradient id=g x1=0 y1=0 x2=.4 y2=1><stop offset=0 stop-color=#FFB547 /><stop offset=.55 stop-color=#FF7A00 /><stop offset=1 stop-color=#C24E00 /></linearGradient></defs><g fill=url(#g)>
<path d="M66 2C62 28 40 44 22 58C16 63 12 70 12 80C24 60 50 48 62 26C66 18 68 10 66 2Z"/>
<path d="M66 44C62 70 40 86 22 100C16 105 12 112 12 122C24 102 50 90 62 68C66 60 68 52 66 44Z"/>
<path d="M66 86C62 112 40 128 22 142C16 147 12 152 12 160C24 144 50 132 62 110C66 102 68 94 66 86Z"/></g></svg>
<b>مبين <span>نيوز</span></b></div></body></html>"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 512, 'height': 512})
        (OUT / 'icon.html').write_text(ICON.replace('FONT', (A / 'fonts' / 'Cairo.ttf').as_uri()), encoding='utf-8')
        await pg.goto((OUT / 'icon.html').resolve().as_uri()); await pg.wait_for_timeout(800)
        await pg.screenshot(path=str(OUT / 'icon-512.png'))
        (OUT / 'icon.html').unlink()

        ctx = await b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=3)
        pg = await ctx.new_page()

        async def route(r):
            u = r.request.url
            for k, s in (('mehrnews', 'mehr'), ('irna', 'irna'), ('tasnim', 'tasnim')):
                if k in u:
                    return await r.fulfill(body=rss(s), content_type='text/xml; charset=utf-8')
            if u.startswith('file:'):
                return await r.continue_()
            return await r.abort()
        await pg.route('**/*', route)
        await pg.goto((A / 'index.html').as_uri())
        await pg.wait_for_timeout(2500)
        hide = "document.getElementById('netBadge').hidden=true"
        for i, view in enumerate(['breaking', 'news', 'live', 'quran'], 1):
            await pg.click(f'.tab[data-view={view}]')
            await pg.wait_for_timeout(1200)
            await pg.evaluate(hide)
            await pg.screenshot(path=str(OUT / f'shot-{i}.png'))
        await b.close()

asyncio.run(main())
