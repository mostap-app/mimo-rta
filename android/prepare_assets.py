from pathlib import Path
import gzip
import shutil
root = Path(__file__).resolve().parent.parent
assets = root / "android/app/src/main/assets"
assets.mkdir(parents=True, exist_ok=True)
for name in ("MOBILECLIP_LICENSE.txt", "icon-180.png", "icon-512.png", "manifest.webmanifest", "model.part1.wasm", "model.part2.wasm", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm", "ort.wasm.min.js"):
    shutil.copy2(root / name, assets / name)
shutil.copy2(root / "konfidentsialnost.html", assets / "konfidentsialnost.html")
# Android serves the OCR dictionary by its uncompressed asset name.
scan_dir = assets / "scan"
shutil.copytree(root / "scan", scan_dir, ignore=shutil.ignore_patterns("rus.traineddata.gz"), dirs_exist_ok=True)
(scan_dir / "rus.traineddata.gz").unlink(missing_ok=True)
with gzip.open(root / "scan/rus.traineddata.gz", "rb") as source, (scan_dir / "rus.traineddata").open("wb") as target:
    shutil.copyfileobj(source, target)
s = (root / "index.html").read_text(encoding="utf-8")
# Single "Фото блюда" input; Android displays camera/gallery choice natively.
assert s.count('accept="image/*" id="photoIn"') == 2
assert 'id="galleryIn"' not in s
(assets / "index.html").write_text(s, encoding="utf-8")
print("Single photo action prepared. HTML bytes:", len(s.encode()))
