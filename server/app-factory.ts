import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { existsSync } from "fs";
import path from "path";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { SpaFallbackFilter } from "./common/filters/spa-fallback.filter";

type Bucket = { count: number; resetAt: number; lastSeen: number };
type RateRule = { bucket: string; max: number; windowMs: number };
type AppOptions = { serveSpa?: boolean };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
let requestsSinceSweep = 0;

function rateLimitFor(req: Request): RateRule {
  if (req.path === "/api/auth/login") {
    return { bucket: "login", max: 10, windowMs: 15 * 60_000 };
  }
  if (req.path === "/api/auth/register") {
    return { bucket: "register", max: 5, windowMs: 60 * 60_000 };
  }
  if (req.method === "POST" && req.path === "/api/requests") {
    return { bucket: "submission", max: 20, windowMs: 60 * 60_000 };
  }
  if (
    req.method === "POST" &&
    /^\/api\/comics\/[a-fA-F0-9]{24}\/progress$/.test(req.path)
  ) {
    return { bucket: "reading-progress", max: 900, windowMs: 15 * 60_000 };
  }
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    return { bucket: "mutation", max: 180, windowMs: 15 * 60_000 };
  }
  if (req.path === "/api/auth/me") {
    return { bucket: "session", max: 240, windowMs: 15 * 60_000 };
  }
  return { bucket: "api", max: 1200, windowMs: 15 * 60_000 };
}

function sweepBuckets(now: number, force = false) {
  requestsSinceSweep += 1;
  if (!force && requestsSinceSweep < 500) return;
  requestsSinceSweep = 0;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  if (buckets.size <= MAX_BUCKETS) return;
  const oldest = [...buckets.entries()]
    .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
    .slice(0, buckets.size - MAX_BUCKETS);
  for (const [key] of oldest) buckets.delete(key);
}

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/") || req.method === "OPTIONS") {
    next();
    return;
  }

  const now = Date.now();
  sweepBuckets(now, buckets.size >= MAX_BUCKETS);
  const rule = rateLimitFor(req);
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${ip}:${rule.bucket}`;
  const current = buckets.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + rule.windowMs, lastSeen: now }
      : current;

  bucket.count += 1;
  bucket.lastSeen = now;
  buckets.set(key, bucket);

  res.setHeader("X-RateLimit-Limit", String(rule.max));
  res.setHeader(
    "X-RateLimit-Remaining",
    String(Math.max(0, rule.max - bucket.count)),
  );
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > rule.max) {
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
    );
    res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
    });
    return;
  }

  next();
}

function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Origin-Agent-Cluster", "?1");

  if (req.path.startsWith("/api/") || req.headers.authorization) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
  }

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.amazonaws.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
    );
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  next();
}

function originOf(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredOrigins(production: boolean) {
  const origins = new Set<string>();
  const appOrigin = originOf(process.env.APP_URL);

  if (production) {
    if (!appOrigin) {
      throw new Error(
        "APP_URL must be a valid absolute URL when NODE_ENV=production",
      );
    }
    if (!appOrigin.startsWith("https://")) {
      throw new Error("APP_URL must use HTTPS when NODE_ENV=production");
    }
  }

  if (appOrigin) origins.add(appOrigin);

  for (const value of (process.env.CORS_ORIGINS || "").split(",")) {
    const origin = originOf(value.trim());
    if (origin) origins.add(origin);
  }

  if (!production) {
    origins.add("http://localhost:8080");
    origins.add("http://127.0.0.1:8080");
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

export async function createApplication(options: AppOptions = {}) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable("x-powered-by");
  app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);

  const production = process.env.NODE_ENV === "production";
  const allowedOrigins = configuredOrigins(production);

  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"), false);
    },
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 3600,
  });

  app.use(securityHeaders);
  app.use(rateLimiter);

  let spaPath: string | null = null;
  if (options.serveSpa !== false) {
    const distPath = path.join(__dirname, "..", "spa");
    if (existsSync(path.join(distPath, "index.html"))) {
      app.useStaticAssets(distPath, { index: false, fallthrough: true });
      spaPath = distPath;
    }
  }

  app.useGlobalFilters(new SpaFallbackFilter(spaPath));
  return app;
}
