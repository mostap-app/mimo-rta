from pathlib import Path
import shutil
root = Path(__file__).resolve().parent.parent
assets = root / "android/app/src/main/assets"
assets.mkdir(parents=True, exist_ok=True)
for name in ("MOBILECLIP_LICENSE.txt", "icon-180.png", "icon-512.png", "manifest.webmanifest", "model.part1.wasm", "model.part2.wasm", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm", "ort.wasm.min.js"):
    shutil.copy2(root / name, assets / name)
shutil.copytree(root / "scan", assets / "scan", dirs_exist_ok=True)
s = (root / "index.html").read_text(encoding="utf-8")
assert s.count('accept="image/*" id="photoIn"') == 2
s = s.replace('accept="image/*" id="photoIn"', 'accept="image/*" capture="environment" id="photoIn"')
import re
# Gallery picker is a separate input. Camera launches only by explicit choice.
gallery = '<label class="photo-btn"><input type="file" accept="image/*" id="galleryIn" style="position:absolute;width:1px;height:1px;opacity:0">Из галереи</label>'
s, n = re.subn(r'(<label class="photo-btn">\s*<input type="file" accept="image/\*" capture="environment" id="photoIn")', gallery + r'\1', s)
assert n == 2
assert s.count('if(e.target.id==="photoIn")return startPhoto(f);') == 1
s = s.replace('if(e.target.id==="photoIn")return startPhoto(f);', 'if(e.target.id==="photoIn"||e.target.id==="galleryIn")return startPhoto(f);')
(assets / "index.html").write_text(s, encoding="utf-8")
print("Gallery and camera have separate inputs. HTML bytes:", len(s.encode()))
