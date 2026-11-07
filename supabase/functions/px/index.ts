// Supabase / Lovable Edge Function: px & proxy
// Direct endpoint: /api/public/px or /functions/v1/px
// Handles CORS unblocking, M3U8 manifest rewriting, and zero-buffer streaming

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
  "Access-Control-Allow-Headers": "Range, Content-Type, Authorization, If-Modified-Since, X-Requested-With, If-Range, If-None-Match, Origin",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type, Date, Server",
  "Access-Control-Max-Age": "86400",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const reqUrl = new URL(req.url);
  let targetUrl = reqUrl.searchParams.get("u") || reqUrl.searchParams.get("url");

  if (!targetUrl) {
    return new Response(
      JSON.stringify(
        {
          status: "online",
          service: "Universal High-Speed CORS Media Relay",
          version: "2.1.0",
          usage: `${reqUrl.origin}${reqUrl.pathname}?u=<STREAM_OR_M3U8_URL>`,
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }

  // Prevent double-wrapping bugs
  while (targetUrl.includes("/api/proxy?u=") || targetUrl.includes("/proxy?u=")) {
    const idx = targetUrl.indexOf("?u=");
    if (idx !== -1) {
      targetUrl = decodeURIComponent(targetUrl.substring(idx + 3));
    } else {
      break;
    }
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const customReferer = reqUrl.searchParams.get("referer");

    const fetchHeaders = new Headers();
    if (customReferer) {
      fetchHeaders.set("Referer", customReferer);
    } else {
      fetchHeaders.set("Referer", `${parsedTarget.protocol}//${parsedTarget.host}/`);
    }

    fetchHeaders.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    );
    fetchHeaders.set("Accept", "*/*");

    const clientRange = req.headers.get("Range");
    if (clientRange) {
      fetchHeaders.set("Range", clientRange);
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: fetchHeaders,
      redirect: "follow",
    });

    const resHeaders = new Headers();
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      resHeaders.set(k, v);
    }

    const forwardHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ];
    for (const h of forwardHeaders) {
      const val = upstreamRes.headers.get(h);
      if (val) resHeaders.set(h, val);
    }

    resHeaders.delete("x-frame-options");
    resHeaders.delete("content-security-policy");
    resHeaders.delete("content-security-policy-report-only");

    const contentType = (upstreamRes.headers.get("content-type") || "").toLowerCase();
    const isM3U8 =
      targetUrl.includes(".m3u8") ||
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      contentType.includes("audio/x-mpegurl");
    const isHTML = contentType.includes("text/html");

    if (isM3U8) {
      const text = await upstreamRes.text();
      const proxyBase = `${reqUrl.origin}${reqUrl.pathname}?u=`;
      const rewritten = rewriteM3u8(text, targetUrl, proxyBase);

      resHeaders.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      resHeaders.set("Cache-Control", "public, max-age=2, s-maxage=2");
      return new Response(rewritten, {
        status: upstreamRes.status,
        headers: resHeaders,
      });
    }

    if (isHTML) {
      let html = await upstreamRes.text();
      const baseTag = `<base href="${parsedTarget.protocol}//${parsedTarget.host}/">`;
      html = html.includes("<head>") ? html.replace("<head>", `<head>${baseTag}`) : baseTag + html;

      resHeaders.set("Content-Type", "text/html; charset=utf-8");
      resHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
      return new Response(html, {
        status: upstreamRes.status,
        headers: resHeaders,
      });
    }

    const isSegment =
      targetUrl.includes(".ts") ||
      targetUrl.includes(".m4s") ||
      targetUrl.includes(".mp4") ||
      targetUrl.includes(".key");
    if (isSegment) {
      resHeaders.set("Cache-Control", "public, max-age=180, s-maxage=180, immutable");
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message, target: targetUrl }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});

function rewriteM3u8(manifest: string, originalUrl: string, proxyBase: string): string {
  const lines = manifest.split(/\r?\n/);
  const parsed = new URL(originalUrl);
  const basePath = originalUrl.substring(0, originalUrl.lastIndexOf("/") + 1);

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#EXT-X-KEY:") || trimmed.startsWith("#EXT-X-MAP:")) {
        return line.replace(/URI="([^"]+)"/, (_, uri) => {
          const resolved = resolveUrl(uri, basePath, parsed.origin);
          return `URI="${proxyBase}${encodeURIComponent(resolved)}"`;
        });
      }

      if (trimmed.startsWith("#")) {
        return line;
      }

      const resolved = resolveUrl(trimmed, basePath, parsed.origin);
      return `${proxyBase}${encodeURIComponent(resolved)}`;
    })
    .join("\n");
}

function resolveUrl(urlStr: string, basePath: string, origin: string): string {
  if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) {
    return urlStr;
  }
  if (urlStr.startsWith("/")) {
    return `${origin}${urlStr}`;
  }
  return `${basePath}${urlStr}`;
}
