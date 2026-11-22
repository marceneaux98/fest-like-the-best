"""Local server for the festival pages that never lets the browser use stale data files.

Usage:  py serve.py            (then open http://localhost:8765/lineup.html)
        py serve.py 9000       (different port)
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()


def main():
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8765))
    here = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(NoCacheHandler, directory=here)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print("Serving on http://localhost:%d/lineup.html  (Ctrl+C to stop)" % port)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
