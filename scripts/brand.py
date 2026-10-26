"""Builds the caracebu logo pieces from Shrikhand (the logo's font, free, OFL):
assets/fonts/brand.ttf (only the letters of "caracebu"), the same font inlined in public/index.html
for the loading skeleton, and the Home Screen icons in public/icons. The browser tab icon stays the plain "c".
Get Shrikhand-Regular.ttf from https://github.com/google/fonts/tree/main/ofl/shrikhand, then run:
python scripts/brand.py path/to/Shrikhand-Regular.ttf"""
import base64
import re
import sys

from fontTools import subset  # pip install fonttools
from PIL import Image, ImageDraw, ImageFont  # pip install pillow

RED, PINK = '#EE3C4C', '#FEEBE7'

opts = subset.Options()
opts.name_IDs = ['*']  # keeps the copyright and licence notice
font = subset.load_font(sys.argv[1], opts)
sub = subset.Subsetter(opts)
sub.populate(text='caracebu')
sub.subset(font)
subset.save_font(font, 'assets/fonts/brand.ttf', opts)

data = base64.b64encode(open('assets/fonts/brand.ttf', 'rb').read()).decode()
html = open('public/index.html', encoding='utf-8').read()
html = re.sub(r'url\(data:font/ttf;base64,[^)]*\)', f'url(data:font/ttf;base64,{data})', html)
open('public/index.html', 'w', encoding='utf-8', newline='\n').write(html)

# The logo as on Instagram: "cara" over "cebu". Proportions measured from the client's 1080 px file;
# the letters stay inside the middle 80% circle, so Android's round crop ("maskable") never cuts them.
for name, size in [('icon-192', 192), ('icon-512', 512), ('apple-touch-icon', 180)]:
    s = size * 4  # draw large, then shrink, for smooth edges
    im = Image.new('RGB', (s, s), PINK)
    draw = ImageDraw.Draw(im)
    f = ImageFont.truetype('assets/fonts/brand.ttf', round(s * 0.27))
    draw.text((s * 0.5, s * 0.443), 'cara', font=f, fill=RED, anchor='ms')
    draw.text((s * 0.5, s * 0.665), 'cebu', font=f, fill=RED, anchor='ms')
    im.resize((size, size), Image.LANCZOS).save(f'public/icons/{name}.png', optimize=True)
print(f'brand.ttf {len(data) * 3 // 4} bytes, 3 icons written')
