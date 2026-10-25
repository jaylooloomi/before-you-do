"""Verify versioned release archives with stdlib only; never launches the app."""
import hashlib
import json
import plistlib
import re
import struct
import sys
import zipfile
from pathlib import Path

tag, directory = sys.argv[1], Path(sys.argv[2])
if not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
    raise SystemExit("Invalid release tag")
version = tag[1:]
if json.loads(Path("package.json").read_text(encoding="utf-8"))["version"] != version:
    raise SystemExit("Source/tag mismatch")
archives = sorted(directory.glob(f"before-you-do-{tag}-*.zip"))
expected = {f"before-you-do-{tag}-{platform}.zip" for platform in ("windows-x64", "macos-apple-silicon", "macos-intel")}
if {p.name for p in archives} != expected:
    raise SystemExit("Expected exactly Windows, Apple Silicon and Intel archives")

def pe_x64(data):
    assert data[:2] == b"MZ", "Missing PE executable"
    offset = struct.unpack_from("<I", data, 0x3C)[0]
    assert data[offset:offset + 4] == b"PE\0\0", "Invalid PE header"
    assert struct.unpack_from("<H", data, offset + 4)[0] == 0x8664, "Not Windows x64"

for archive in archives:
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None, "Corrupt ZIP"
        if "windows-x64" in archive.name:
            for name in ("before-you-do.exe", "WebView2Loader.dll", "START-HERE.txt"):
                assert name in bundle.namelist(), f"Missing {name}"
            pe_x64(bundle.read("before-you-do.exe"))
            pe_x64(bundle.read("WebView2Loader.dll"))
            assert tag in bundle.read("START-HERE.txt").decode("utf-8")
        else:
            base = "before-you-do.app/Contents/"
            info = plistlib.loads(bundle.read(base + "Info.plist"))
            assert info["CFBundleShortVersionString"] == version, "Mac version mismatch"
            executable = bundle.read(base + "MacOS/before-you-do")
            assert executable[:4] == b"\xcf\xfa\xed\xfe", "Expected thin Mach-O 64-bit"
            cpu = struct.unpack_from("<I", executable, 4)[0]
            assert cpu == (0x0100000C if "apple-silicon" in archive.name else 0x01000007), "Mac architecture mismatch"
    print(f"Verified {archive.name} ({archive.stat().st_size} bytes)")
checksums = "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in archives)
(directory / "SHA256SUMS.txt").write_text(checksums, encoding="utf-8", newline="\n")
