import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config as defaultConfig } from './config.js';
import { createStore, StoreError } from './store.js';
import { createHub } from './hub.js';
import { backupNotice, buildRouteMatrix, createCircuitBreaker, enrichPlanWithOsrm } from './providers/routing.js';
import { errorText, requestLang } from './i18n.js';
import { createRateLimiter } from './security/rateLimit.js';
import { createAuth, passwordsMatch, requireRole } from './security/auth.js';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend');

export function createApp(options = {}) {
  const cfg = options.config || defaultConfig;
  const hub = options.hub || createHub();
  const store =
    options.store ||
    createStore({
      config: cfg,
      onChange: () => hub.publish('changed', { at: Date.now() }),
    });

  const breaker = options.breaker || createCircuitBreaker();
  const routeCache = options.routeCache || new Map();
  const fetchImpl = options.fetchImpl;
  const routingTimeoutMs = options.routingTimeoutMs || cfg.routingTimeoutMs || 5000;
  const guard = { ...cfg.sosGuard, ...options.sosGuard };
  const now = options.now || Date.now;
  const ipLimiter = createRateLimiter({ limit: guard.ipLimit, windowMs: guard.ipWindowMs, now });
  const sessionLimiter = createRateLimiter({ limit: guard.sessionLimit, windowMs: guard.sessionWindowMs, now });
  const globalLimiter = createRateLimiter({ limit: guard.globalLimit, windowMs: guard.globalWindowMs, now });
  const auth = createAuth(cfg.auth.jwtSecret, { ttlSec: cfg.auth.tokenTtlSec, now });
  const dispatcherOnly = requireRole(auth, 'dispatcher');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'urban-crisis-engine' });
  });

  app.get('/api/citizen/zones', (req, res) => {
    res.json(store.citizenMeta());
  });

  app.post('/api/citizen/plan', async (req, res, next) => {
    try {
      const lang = requestLang(req);
      const plan = store.plan({ ...(req.body || {}), lang });
      if (cfg.routingProvider === 'osrm') {
        try {
          await enrichPlanWithOsrm(plan, {
            baseUrl: cfg.osrmUrl,
            timeoutMs: routingTimeoutMs,
            fetchImpl,
            breaker,
            cache: routeCache,
            matrix: buildRouteMatrix(store.localNetwork()),
            lang,
          });
        } catch {
          plan.routing = {
            provider: 'fallback',
            mode: 'backup',
            fallback: true,
            source: 'matrix',
            notice: backupNotice(lang),
          };
        }
      }
      res.json(plan);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    try {
      const username = String(req.body?.username || '');
      const password = String(req.body?.password || '');
      const userOk = passwordsMatch(username, cfg.auth.dispatcherUser);
      const passOk = passwordsMatch(password, cfg.auth.dispatcherPassword);
      if (!userOk || !passOk) {
        throw new StoreError(401, 'Giriş qəbul olunmadı', 'BAD_LOGIN');
      }
      const token = auth.sign({ sub: cfg.auth.dispatcherUser, role: 'dispatcher' });
      res.json({ token, role: 'dispatcher', expiresIn: cfg.auth.tokenTtlSec });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/citizen/sos', (req, res, next) => {
    try {
      admitSos(req, res);
      res.status(201).json(store.addSos(req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/citizen/safe', (req, res, next) => {
    try {
      res.json(store.markSafe(req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/citizen/status', (req, res, next) => {
    try {
      res.json(store.session(req.query.sessionId));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/traffic', (req, res) => {
    res.json(store.traffic());
  });

  app.get('/api/operator/state', (req, res) => {
    res.json(store.operatorState(requestLang(req)));
  });

  app.post('/api/operator/alerts/:id/confirm', dispatcherOnly, (req, res, next) => {
    try {
      res.json(store.confirmAlert(req.params.id));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/operator/roads/:id/toggle', dispatcherOnly, (req, res, next) => {
    try {
      res.json(store.toggleRoad(req.params.id));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/operator/shelters/:id/occupancy', dispatcherOnly, (req, res, next) => {
    try {
      res.json(store.setOccupancyPercent(req.params.id, req.body?.percent));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/operator/demo/cluster', dispatcherOnly, (req, res, next) => {
    try {
      res.status(201).json(store.demoCluster(req.body?.zoneId || 'nasimi'));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/operator/demo/signal', dispatcherOnly, (req, res, next) => {
    try {
      res.status(201).json(store.demoSignal(req.body?.zoneId || 'nasimi', req.body?.type || 'fire'));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write('retry: 3000\n\n');
    const remove = hub.add(res);
    const timer = setInterval(() => {
      res.write(': ping\n\n');
    }, 20000);
    req.on('close', () => {
      clearInterval(timer);
      remove();
    });
  });

  app.get('/operator', (req, res) => {
    res.sendFile(path.join(publicDir, 'operator.html'));
  });

  app.use(express.static(publicDir));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint tapılmadı' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const lang = requestLang(req);
    const status = Number.isInteger(error.status) ? error.status : 500;
    const translated = error.code ? errorText(error.code, lang) : null;
    const message = translated || (Number.isInteger(error.status) ? error.message : lang === 'en' ? 'Internal error' : 'Daxili xəta');
    if (status === 500) console.error(error);
    res.status(status).json({ error: message });
  });

  function admitSos(req, res) {
    const ip = clientIp(req);
    const sessionId = String(req.body?.sessionId || 'anon').slice(0, 80);
    const checks = [ipLimiter.hit(ip), sessionLimiter.hit(`${ip}|${sessionId}`), globalLimiter.hit('citizen-sos')];
    const blocked = checks.find((item) => !item.ok);
    if (!blocked) return;
    const retryAfter = Math.max(1, Math.ceil(Math.max(...checks.map((item) => item.retryAfterMs || 0)) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    throw new StoreError(429, 'Çox sayda SOS. Bir az gözləyin.', 'RATE_LIMIT');
  }

  return { app, store, hub, auth };
}

function clientIp(req) {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((item) => item.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last.slice(0, 64);
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
