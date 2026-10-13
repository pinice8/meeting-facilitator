"""Generates manifest/color.png (192x192) and manifest/outline.png (32x32). Run: python3 -I scripts/make-icons.py"""
import math, struct, zlib

def write_png(path, size, pixel):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row += bytes(pixel(x + 0.5, y + 0.5, size))
        rows.append(bytes(row))
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(b"".join(rows))) + chunk(b"IEND", b"")
    open(path, "wb").write(png)

def clock_mask(x, y, size):
    """True where the clock glyph (ring + hands) is drawn, in unit coordinates."""
    u, v = (x / size - 0.5) * 2, (y / size - 0.5) * 2
    r = math.hypot(u, v)
    ring = 0.52 <= r <= 0.66
    def seg(ax, ay, bx, by, w):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(u - (ax + t * dx), v - (ay + t * dy)) <= w
    return ring or seg(0, 0, 0, -0.38, 0.06) or seg(0, 0, 0.26, 0.12, 0.06)

def color(x, y, size):
    u, v = abs(x / size - 0.5) * 2, abs(y / size - 0.5) * 2
    inside = (u < 0.84 and v < 0.84) and not (u > 0.6 and v > 0.6 and math.hypot(u - 0.6, v - 0.6) > 0.24)
    if not inside:
        return (0, 0, 0, 0)
    return (255, 255, 255, 255) if clock_mask(x, y, size) else (91, 95, 199, 255)

def outline(x, y, size):
    return (255, 255, 255, 255) if clock_mask(x, y, size) else (0, 0, 0, 0)

write_png("manifest/color.png", 192, color)
write_png("manifest/outline.png", 32, outline)
