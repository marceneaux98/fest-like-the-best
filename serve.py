"""Local server for the festival pages that never lets the browser use stale data files.

Usage:  python serve.py            (then open http://localhost:8765/ ; python3 on Mac/Linux)
        python serve.py 9000       (different port)

Dev helper: a page served from here may POST to /__save/<name>.svg, .json or .png and the body is
written to assets/<name> (used by tools/pdf2svg.html, tools/poster-routes.html, tools/og-image.html).
Only .svg/.json/.png, only into assets/, only with the X-FLTB-Save header (so other websites can't trigger it),
and the server only ever listens on 127.0.0.1.
"""
import functools
import http.server
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SAVE_NAME = re.compile(r"^[A-Za-z0-9_-]{1,64}\.(svg|json|png)$")
SAVE_MAX = 64 * 1024 * 1024


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def do_POST(self):
        name = self.path[len("/__save/"):] if self.path.startswith("/__save/") else ""
        if not SAVE_NAME.match(name) or self.headers.get("X-FLTB-Save") != "1":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= SAVE_MAX:
            self.send_error(413)
            return
        data = self.rfile.read(length)
        if name.endswith(".svg") and b"<svg" not in data[:4096]:
            self.send_error(400, "not an svg")
            return
        if name.endswith(".png") and not data.startswith(bytes([0x89]) + b"PNG"):
            self.send_error(400, "not a png")
            return
        if name.endswith(".json"):
            try:
                json.loads(data.decode("utf-8"))
            except ValueError:
                self.send_error(400, "not json")
                return
        out = os.path.join(HERE, "assets", name)
        with open(out, "wb") as f:
            f.write(data)
        body = ("saved assets/%s (%d bytes)" % (name, length)).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8765))
    handler = functools.partial(NoCacheHandler, directory=HERE)
    http.server.ThreadingHTTPServer.request_queue_size = 64   # default 5 drops connections when two test runs load pages at once
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print("Serving on http://localhost:%d/  (Ctrl+C to stop)" % port)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
