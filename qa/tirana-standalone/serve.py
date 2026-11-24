"""Loopback-only launcher QA; no real users, endpoints or writes."""
import http.server
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[2] / 'webapp/.tirana-ci/dist'
pages = {'/games', '/games/tiranastreets', '/games/tiranastreets/lobby'}
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=root, **kwargs)
    def end_headers(self):
        self.send_header('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'self'; img-src 'self' data:; style-src 'self'")
        super().end_headers()
    def dispatch(self, fn):
        path = urlsplit(self.path).path.rstrip('/')
        if path == '':
            self.send_response(302)
            self.send_header('Location', '/games')
            self.end_headers()
            return
        if path in pages:
            self.path = '/.tirana-ci/standalone-preview.html'
        elif not path.startswith('/assets/'):
            self.send_error(404)
            return
        fn()
    def do_GET(self):
        self.dispatch(super().do_GET)
    def do_HEAD(self):
        self.dispatch(super().do_HEAD)
    def do_POST(self):
        self.send_error(405)

if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', 4183), Handler).serve_forever()
