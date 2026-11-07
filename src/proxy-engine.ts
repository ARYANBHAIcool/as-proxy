// AryanStreams Universal High-Performance Edge Proxy Engine
// Handles zero-copy streaming, M3U8 rewriting, anti-iframe stripping, and header spoofing

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
  "Access-Control-Allow-Headers": "Range, Content-Type, Authorization, If-Modified-Since, X-Requested-With, If-Range, If-None-Match, Origin",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type, Date, Server",
  "Access-Control-Max-Age": "86400",
};

export async function handleProxyRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const reqUrl = new URL(request.url);
  let targetUrl = reqUrl.searchParams.get("u") || reqUrl.searchParams.get("url");

  if (!targetUrl) {
    return new Response(
      JSON.stringify(
        {
          status: "online",
          service: "AryanStreams Universal High-Speed Edge Proxy",
          version: "2.1.0",
          usage: `${reqUrl.origin}/api/proxy?u=<STREAM_OR_M3U8_URL>&referer=<OPTIONAL_REFERER>`,
          endpoints: [
            "/api/proxy?u=",
            "/proxy?u=",
            "/api/public/px?url=",
          ],
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  // Prevent double-wrapping bugs if URL was already proxied
  while (targetUrl.includes("/api/proxy?u=") || targetUrl.includes("/proxy?u=")) {
    const idx = targetUrl.indexOf("?u=");
    if (idx !== -1) {
      targetUrl = decodeURIComponent(targetUrl.substring(idx + 3));
    } else {
      break;
    }
  }

  try {
    let effectiveUrl = targetUrl;
    if (effectiveUrl.includes("embed.st/")) {
      effectiveUrl = effectiveUrl.replace("embed.st/", "ppv.ms/");
    } else if (effectiveUrl.includes("ppv.st/")) {
      effectiveUrl = effectiveUrl.replace("ppv.st/", "ppv.ms/");
    }

    const parsedTarget = new URL(effectiveUrl);
    const customReferer = reqUrl.searchParams.get("referer");

    const fetchHeaders = new Headers();
    const isSony = effectiveUrl.includes("dishmt.slivcdn.com") || effectiveUrl.includes("sonyliv.com");
    const isFanCode = effectiveUrl.includes("fancode.com") || effectiveUrl.includes("fc-") || effectiveUrl.includes("zyphx8");
    const isJio = effectiveUrl.includes("jiotv") || effectiveUrl.includes("jio");

    if (customReferer) {
      fetchHeaders.set("Referer", customReferer);
      try {
        const refOrigin = new URL(customReferer).origin;
        fetchHeaders.set("Origin", refOrigin);
      } catch {
        fetchHeaders.set("Origin", `${parsedTarget.protocol}//${parsedTarget.host}`);
      }
    } else if (isSony) {
      fetchHeaders.set("Referer", "https://www.sonyliv.com/");
      fetchHeaders.set("Origin", "https://www.sonyliv.com");
    } else if (isFanCode) {
      fetchHeaders.set("Referer", "https://www.fancode.com/");
      fetchHeaders.set("Origin", "https://www.fancode.com");
    } else {
      fetchHeaders.set("Referer", `${parsedTarget.protocol}//${parsedTarget.host}/`);
      fetchHeaders.set("Origin", `${parsedTarget.protocol}//${parsedTarget.host}`);
    }

    if (isJio) {
      fetchHeaders.set("User-Agent", "plaYtv/7.1.3 (Linux;Android 14) ExoPlayerLib/2.11.7");
    } else {
      fetchHeaders.set(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      );
    }
    fetchHeaders.set("Accept", "*/*");

    const clientRange = request.headers.get("Range");
    if (clientRange) {
      fetchHeaders.set("Range", clientRange);
    }

    const upstreamRes = await fetch(effectiveUrl, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers: fetchHeaders,
      redirect: "follow",
    });

    const resHeaders = new Headers();
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      resHeaders.set(k, v);
    }

    // Forward necessary streaming headers from upstream
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

    // Strip frame & security restrictions
    resHeaders.delete("x-frame-options");
    resHeaders.delete("content-security-policy");
    resHeaders.delete("content-security-policy-report-only");

    const contentType = (upstreamRes.headers.get("content-type") || "").toLowerCase();
    const isM3U8 =
      effectiveUrl.includes(".m3u8") ||
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegurl") ||
      contentType.includes("audio/x-mpegurl");
    const isHTML =
      contentType.includes("text/html") ||
      effectiveUrl.includes("/embed") ||
      effectiveUrl.includes("/live/");

    // Case 1: M3U8 Playlist (Rewrite lines)
    if (isM3U8) {
      const text = await upstreamRes.text();
      const proxyBase = `${reqUrl.origin}${reqUrl.pathname}?u=`;
      const rewritten = rewriteM3u8(text, effectiveUrl, proxyBase);

      resHeaders.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      resHeaders.set("Cache-Control", "public, max-age=2, s-maxage=2");
      return new Response(rewritten, {
        status: upstreamRes.status,
        headers: resHeaders,
      });
    }

    // Case 2: HTML Embed
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

    // Case 3: Video Chunks / Audio / Segments (TS, M4S, MP4, AAC)
    // Cache segments for 180s to save CPU / bandwidth
    const isSegment =
      effectiveUrl.includes(".ts") ||
      effectiveUrl.includes(".m4s") ||
      effectiveUrl.includes(".mp4") ||
      effectiveUrl.includes(".key");
    if (isSegment) {
      resHeaders.set("Cache-Control", "public, max-age=180, s-maxage=180, immutable");
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify(
        {
          error: "Proxy upstream connection error",
          message: err?.message || String(err),
          target: targetUrl,
        },
        null,
        2,
      ),
      {
        status: 502,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }
}

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
