#!/usr/bin/env python3
"""Write a plain 600x400 gradient PNG with no DPI set, using only the stdlib.
verify.sh turns it into the other fixtures with sips.

Usage: make-fixtures.py OUT.png"""
import struct, sys, zlib

w, h = 600, 400
rows = b''.join(b'\x00' + b''.join(bytes((x * 255 // w, y * 255 // h, 128)) for x in range(w))
               for y in range(h))

def chunk(t, d):
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))

png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
       + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))
open(sys.argv[1], 'wb').write(png)
