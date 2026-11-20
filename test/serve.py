#!/usr/bin/env python3
"""Static file server for a verify run, plus a POST endpoint the probe reports to.

`python3 -m http.server` covers the static half, but it has no way to receive
results. Getting them back over HTTP is far more reliable than smuggling them
through the DOM and hoping Chrome dumps at the right moment.

The probe also POSTs the zip it downloaded to /__zip, so verify.sh can open
it with real tools.

Usage: serve.py PORT ROOT RESULTS_FILE ZIP_FILE
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

port, root, results_path, zip_path = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        if self.path == '/__zip':
            with open(zip_path, 'wb') as f:
                f.write(body)
            self.send_response(204)
            self.end_headers()
            return
        with open(results_path, 'w', encoding='utf-8') as f:
            f.write(body.decode('utf-8', 'replace'))
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        # Chrome caches aggressively even on localhost; a stale app.js would
        # make a run report on code that is no longer on disk.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=root)).serve_forever()
