"""Generate the local geometric app icon; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / 'src-tauri' / 'icons'
out.mkdir(parents=True, exist_ok=True)
im = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((8, 8, 248, 248), radius=60, fill='#356752')
d.ellipse((58, 48, 188, 178), outline='#f6f8f2', width=23)
d.line((159, 151, 199, 205), fill='#f6f8f2', width=23)
im.save(out / 'icon.png')
im.save(out / 'icon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
(out / 'tray.rgba').write_bytes(im.resize((32, 32), Image.Resampling.LANCZOS).tobytes())
