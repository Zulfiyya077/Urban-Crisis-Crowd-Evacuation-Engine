import { createHmac, timingSafeEqual } from 'node:crypto';

class AuthError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createAuth(secret, { ttlSec = 8 * 60 * 60, now = Date.now } = {}) {
  return {
    sign(payload) {
      const issued = Math.floor(now() / 1000);
      const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = base64Url(JSON.stringify({ ...payload, iat: issued, exp: issued + ttlSec }));
      const data = `${header}.${body}`;
      const signature = createHmac('sha256', secret).update(data).digest('base64url');
      return `${data}.${signature}`;
    },
    verify(token) {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return null;
      const [header, body, signature] = parts;
      const data = `${header}.${body}`;
      const expected = createHmac('sha256', secret).update(data).digest('base64url');
      const left = Buffer.from(signature);
      const right = Buffer.from(expected);
      if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
      let payload;
      try {
        payload = JSON.parse(Buffer.from(body, 'base64url').toString());
      } catch {
        return null;
      }
      if (!payload?.exp || payload.exp * 1000 <= now()) return null;
      if (payload.role !== 'dispatcher' && payload.role !== 'citizen') return null;
      return payload;
    },
  };
}

export function passwordsMatch(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireRole(auth, role) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = auth.verify(token);
    if (!payload) {
      next(new AuthError(401, 'Dispetçer girişi tələb olunur', 'UNAUTHORIZED'));
      return;
    }
    if (payload.role !== role) {
      next(new AuthError(403, 'Bu əməliyyat üçün dispetçer rolu lazımdır', 'FORBIDDEN'));
      return;
    }
    req.auth = payload;
    next();
  };
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}
