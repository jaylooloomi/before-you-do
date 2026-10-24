"""Export desktop icon formats from the approved, drawn brand master (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
out = root / 'src-tauri' / 'icons'
master = out / 'before-you-do-master.png'
if not master.exists():
    raise SystemExit(f'Approved brand master missing: {master}')
im = Image.open(master).convert('RGBA')
if im.width != im.height:
    raise SystemExit('The icon master must be square.')
if im.getpixel((0, 0))[3] != 0:
    raise SystemExit('The icon master must have transparent exterior corners.')
icon = im.resize((1024, 1024), Image.Resampling.LANCZOS)
icon.save(out / 'icon.png')
icon.save(out / 'icon.ico', sizes=[(16,16),(20,20),(24,24),(32,32),(40,40),(48,48),(64,64),(128,128),(256,256)])
icon.save(out / 'icon.icns')
(out / 'tray.rgba').write_bytes(icon.resize((32,32), Image.Resampling.LANCZOS).tobytes())
assets = root / 'src' / 'assets'
assets.mkdir(exist_ok=True)
icon.resize((128,128), Image.Resampling.LANCZOS).save(assets / 'app-icon.png')
# Diagnostic preview only: show exports at real small sizes on both app palettes.
preview = Image.new('RGB', (640, 210), '#202020')
draw = ImageDraw.Draw(preview)
draw.rectangle((0, 105, 640, 210), fill='#f5f5f5')
for y, label_color in [(0, '#ffffff'), (105, '#202020')]:
    x=20
    for size in [16,24,32,48,64]:
        export=icon.resize((size,size), Image.Resampling.LANCZOS)
        preview.paste(export,(x,y+12),export)
        draw.text((x,y+80),f'{size}px',fill=label_color)
        x+=120
artifacts=root/'artifacts'
artifacts.mkdir(exist_ok=True)
preview.save(artifacts/'icon-size-check.png')
print('Exported PNG, 9 ICO sizes, ICNS, 32px tray RGBA and 128px UI asset.')
