#!/usr/bin/env python3
"""Serve The Sorting Register from ./public. Standard library only.

Usage: python3 serve.py [--port 8080] [--host 0.0.0.0]
"""
import argparse
import functools
import http.server
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8080)))
    p.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    a = p.parse_args()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer((a.host, a.port), handler) as srv:
        print(f"Sorting Register on http://{a.host}:{a.port}  (Ctrl+C to stop)")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
