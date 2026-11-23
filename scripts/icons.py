"""Builds assets/fonts/icons.ttf + icons.json: only the Ionicons the app uses (3 KB, not 390 KB).
Add a name from https://icons.expo.fyi (Ionicons) below, then run: python scripts/icons.py
(Without Python: scripts/icons.mjs does the same with the subset-font npm package.)"""
import json
from fontTools import subset  # pip install fonttools

NAMES = ['add', 'remove', 'close', 'close-circle', 'checkmark', 'search', 'chevron-back', 'chevron-forward',
         'download-outline', 'create-outline', 'eye-outline', 'eye-off-outline',
         # menu icons (design review 8 and small fixes), the catalog's Instagram button (15)
         'menu', 'home-outline', 'bag-handle-outline', 'receipt-outline', 'bar-chart-outline', 'pricetag-outline',
         'folder-outline', 'calendar-outline', 'storefront-outline', 'logo-instagram', 'chevron-down']

SRC = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons'
full = json.load(open(f'{SRC}/glyphmaps/Ionicons.json'))
glyphs = {n: full[n] for n in NAMES}
opts = subset.Options()
opts.layout_features = []
opts.name_IDs = ['*']
font = subset.load_font(f'{SRC}/Fonts/Ionicons.ttf', opts)
sub = subset.Subsetter(opts)
sub.populate(unicodes=list(glyphs.values()))
sub.subset(font)
subset.save_font(font, 'assets/fonts/icons.ttf', opts)
json.dump(glyphs, open('assets/fonts/icons.json', 'w'), indent=2)
print(f'{len(glyphs)} icons written')
