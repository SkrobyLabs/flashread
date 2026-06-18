import struct, zlib, math, os

def png(size, path):
    cx = cy = (size - 1) / 2
    r = size * 0.46
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter type 0
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            a = max(0.0, min(1.0, (r - d) + 0.5))
            if a <= 0:
                rows += bytes((0, 0, 0, 0))
                continue
            R, G, B = 231, 76, 60
            # white slanted bolt accent
            if abs((x - cx) - (cy - y) * 0.35) < size * 0.07 and d < r * 0.8:
                R, G, B = 255, 255, 255
            rows += bytes((R, G, B, int(a * 255)))
    raw = bytes(rows)

    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    out = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) +
           chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    open(path, "wb").write(out)


base = os.path.dirname(os.path.abspath(__file__))
for s in (16, 48, 128):
    png(s, os.path.join(base, f"icon{s}.png"))
print("icons:", sorted(f for f in os.listdir(base) if f.endswith(".png")))
