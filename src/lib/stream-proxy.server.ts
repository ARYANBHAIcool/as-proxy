const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Authorization, If-Modified-Since, X-Requested-With, If-Range, If-None-Match",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified, Date, Server, X-Cache-Status",
  "Access-Control-Max-Age": "86400",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// ── In-memory cache (per worker isolate) ──
interface CacheEntry { status: number; headers: [string, string][]; body: Uint8Array; expires: number }
interface Result { status: number; headers: Headers; body: Uint8Array | ReadableStream | null }
const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Result>>();
const MAX_CACHE_ENTRIES = 350;

function getCached(key: string): CacheEntry | null {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) { memoryCache.delete(key); return null; }
  return item;
}
function setCache(key: string, status: number, headers: Headers, body: Uint8Array, ttl: number) {
  if (status < 200 || status >= 300) return;
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  const list: [string, string][] = [];
  headers.forEach((v, k) => { if (!["set-cookie", "connection", "keep-alive"].includes(k.toLowerCase())) list.push([k, v]); });
  memoryCache.set(key, { status, headers: list, body, expires: Date.now() + ttl * 1000 });
}
export function clearProxyCache() { memoryCache.clear(); inFlight.clear(); }

function errorXml(code: string, provider: string, status: number): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Error>\n  <Code>${code}</Code>\n  <Provider>${provider}</Provider>\n</Error>\n`, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function getProvider(pathname: string): string {
  const p = pathname.toLowerCase();
  if (p.includes("/sony")) return "sony";
  if (p.includes("/geobypass")) return "geobypass";
  if (p.includes("/fancode")) return "fancode";
  return "stream";
}

function isRestricted(target: URL): string | null {
  if (!["http:", "https:"].includes(target.protocol)) return "INVALID_PROTOCOL";
  const h = target.hostname.toLowerCase();
  if (
    target.username || target.password || (target.port && !["80", "443"].includes(target.port)) ||
    h === "localhost" || h === "localhost." || h.startsWith("127.") || h.startsWith("10.") ||
    h.startsWith("192.168.") || h.startsWith("169.254.") || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h) ||
    h.includes(":") || h.startsWith("[") || h.startsWith("0.") || h.endsWith(".internal") || h.endsWith(".local")
  ) return "RESTRICTED_DESTINATION";
  return null;
}

function rewriteM3U8(text: string, finalUrl: string, proxyBase: string): string {
  const abs = (u: string) => `${proxyBase}${encodeURIComponent(new URL(u, finalUrl).toString())}`;
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("#")) {
      if (!trimmed.includes("URI=")) return line;
      return line.replace(/URI=["']([^"']+)["']/g, (m, uri) => { try { return `URI="${abs(uri)}"`; } catch { return m; } });
    }
    try { return abs(trimmed); } catch { return line; }
  }).join("\n");
}

function applyDefaultHeaders(url: string, h: Headers) {
  h.set("User-Agent", UA);
  if (url.includes("akamaized.net") || url.includes("sonyliv") || url.includes("slivcdn")) {
    h.set("Origin", "https://www.sonyliv.com"); h.set("Referer", "https://www.sonyliv.com/");
  } else if (url.includes("fancode.com")) {
    h.set("Origin", "https://www.fancode.com"); h.set("Referer", "https://www.fancode.com/");
  } else if (url.includes("aiv-cdn") || url.includes("pv-cdn") || url.includes("amazon")) {
    h.set("Origin", "https://www.amazon.com"); h.set("Referer", "https://www.amazon.com/gp/");
  } else if (url.includes("peacocktv") || url.includes("pcdn03")) {
    h.set("Origin", "https://www.peacocktv.com"); h.set("Referer", "https://www.peacocktv.com/");
  }
}

class RelayError extends Error { constructor(public code: string, public status: number) { super(code); } }

export async function handleProxy(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  const reqUrl = new URL(req.url);
  const provider = getProvider(reqUrl.pathname);

  let targetUrl = reqUrl.searchParams.get("url") || reqUrl.searchParams.get("u") || "";
  if (!targetUrl) {
    const m = reqUrl.pathname.match(/^\/(?:api\/)?(?:public\/)?(?:px\/[^/]+\/|proxy\/)?(https?:\/.+)$/);
    if (m?.[1]) targetUrl = m[1].replace(/^(https?:)\/(?!\/)/, "$1//");
  }
  // Strip any accidental nested proxy prefixes
  while (targetUrl.includes("/api/proxy?u=") || targetUrl.includes("/proxy?u=") || targetUrl.includes("/px/sony?url=")) {
    const idx = targetUrl.search(/\?(?:u|url)=/);
    if (idx !== -1) {
      const paramStart = targetUrl.indexOf("=", idx) + 1;
      targetUrl = decodeURIComponent(targetUrl.substring(paramStart));
    } else {
      break;
    }
  }
  targetUrl = targetUrl.trim().replace(/[,\s]+$/g, "");
  if (!targetUrl) return errorXml("MISSING_URL", provider, 400);

  let parsedTarget: URL;
  try { parsedTarget = new URL(targetUrl); } catch { return errorXml("INVALID_URL", provider, 400); }
  const bad = isRestricted(parsedTarget);
  if (bad) return errorXml(bad, provider, bad === "INVALID_PROTOCOL" ? 400 : 403);

  const range = req.headers.get("range");
  const cacheable = req.method === "GET" && !range;
  const cacheKey = parsedTarget.href;

  if (cacheable) {
    const cached = getCached(cacheKey);
    if (cached) {
      const h = new Headers(cached.headers); h.set("X-Cache-Status", "HIT-EDGE-MEM");
      return new Response(cached.body.slice(), { status: cached.status, headers: h });
    }
    const pending = inFlight.get(cacheKey);
    if (pending) {
      try {
        const r = await pending;
        if (r.body instanceof Uint8Array) {
          const h = new Headers(r.headers); h.set("X-Cache-Status", "HIT-COALESCED");
          return new Response(r.body.slice(), { status: r.status, headers: h });
        }
      } catch { /* fall through to fresh fetch */ }
    }
  }

  const upstreamHeaders = new Headers();
  if (range) upstreamHeaders.set("Range", range);
  applyDefaultHeaders(targetUrl, upstreamHeaders);

  const run = async (): Promise<Result> => {
    // Manual redirects, each hop validated, max 5, one 15s budget.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let upstream: Response;
    let current = parsedTarget;
    try {
      let redirects = 0;
      while (true) {
        upstream = await fetch(current.href, {
          method: req.method === "HEAD" ? "HEAD" : "GET",
          headers: upstreamHeaders, signal: controller.signal, redirect: "manual",
        });
        if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
        const location = upstream.headers.get("location");
        await upstream.body?.cancel();
        if (!location) throw new RelayError("REDIRECT_NO_LOCATION", 502);
        if (redirects >= 5) throw new RelayError("TOO_MANY_REDIRECTS", 502);
        current = new URL(location, current);
        const badHop = isRestricted(current);
        if (badHop) throw new RelayError(badHop, badHop === "INVALID_PROTOCOL" ? 400 : 403);
        redirects += 1;
      }
    } finally { clearTimeout(timeoutId); }

    const finalUrl = current.href;
    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
    const path = current.pathname.toLowerCase();
    const isM3U8 = contentType.includes("mpegurl") || finalUrl.includes(".m3u8");
    const isKey = path.includes("serve.key") || path.endsWith(".key");
    const isSegment = /\.(ts|m4s|mp4|m4a|m4v|aac)$/.test(path);

    const headers = new Headers(CORS_HEADERS);
    for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag", "date"]) {
      const v = upstream.headers.get(k); if (v) headers.set(k, v);
    }
    headers.set("X-Cache-Status", "MISS");
    const isHead = req.method === "HEAD";

    if (isKey) {
      headers.set("Content-Type", "application/octet-stream");
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      if (isHead) return { status: upstream.status, headers, body: null };
      return { status: upstream.status, headers, body: new Uint8Array(await upstream.arrayBuffer()) };
    }
    if (isM3U8 && upstream.ok && !isHead) {
      const raw = await upstream.text();
      const isMaster = raw.includes("#EXT-X-STREAM-INF") || raw.includes("#EXT-X-I-FRAME-STREAM-INF");
      const isUParam = reqUrl.searchParams.has("u");
      const proxyBase = `${reqUrl.origin}${reqUrl.pathname}?${isUParam ? "u=" : "url="}`;
      const body = new TextEncoder().encode(rewriteM3U8(raw, finalUrl, proxyBase));
      headers.set("Content-Type", "application/vnd.apple.mpegurl");
      headers.delete("content-length");
      if (isMaster) {
        headers.set("Cache-Control", "public, max-age=120, s-maxage=120, stale-while-revalidate=60");
        if (cacheable) setCache(cacheKey, upstream.status, headers, body, 120);
      } else {
        headers.set("Cache-Control", "public, max-age=2, s-maxage=2, stale-while-revalidate=2");
        if (cacheable) setCache(cacheKey, upstream.status, headers, body, 2);
      }
      return { status: upstream.status, headers, body };
    }
    if (isSegment && upstream.ok && !isHead && cacheable) {
      const body = new Uint8Array(await upstream.arrayBuffer());
      headers.set("Content-Type", contentType || "video/MP2T");
      headers.set("Cache-Control", "public, max-age=180, s-maxage=180, immutable");
      setCache(cacheKey, upstream.status, headers, body, 120);
      return { status: upstream.status, headers, body };
    }
    headers.set("Cache-Control", finalUrl.includes(".mpd") || isM3U8 ? "no-cache, no-store, must-revalidate" : "public, max-age=86400, s-maxage=86400");
    return { status: upstream.status, headers, body: isHead ? null : upstream.body };
  };

  const promise = run();
  if (cacheable) inFlight.set(cacheKey, promise);
  try {
    const r = await promise;
    return new Response(r.body instanceof Uint8Array ? r.body.slice() : r.body, { status: r.status, headers: r.headers });
  } catch (err: unknown) {
    if (err instanceof RelayError) return errorXml(err.code, provider, err.status);
    return errorXml("PROXY_FETCH_FAILED", provider, 502);
  } finally {
    if (inFlight.get(cacheKey) === promise) inFlight.delete(cacheKey);
  }
}
