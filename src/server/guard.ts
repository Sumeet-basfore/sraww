import type { NextFunction, Request, Response } from 'express';

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** Returns the hostname part of a "host[:port]" or "http://host:port" string, or null. */
export function hostnameOf(value: string): string | null {
  try {
    const withScheme = value.includes('://') ? value : `http://${value}`;
    return new URL(withScheme).hostname;
  } catch {
    return null;
  }
}

/**
 * Blocks DNS-rebinding and cross-site requests. The server only serves the local user:
 * the Host header must name this machine, and a browser-sent Origin must too.
 */
export function localOnlyGuard(req: Request, res: Response, next: NextFunction): void {
  const host = req.headers.host ? hostnameOf(req.headers.host) : null;
  if (!host || !LOCAL_HOSTNAMES.has(host)) {
    res.status(403).json({ error: 'Forbidden: this server only accepts local requests.' });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    const originHost = hostnameOf(origin);
    if (!originHost || !LOCAL_HOSTNAMES.has(originHost)) {
      res.status(403).json({ error: 'Forbidden: cross-origin requests are not allowed.' });
      return;
    }
  }
  next();
}
