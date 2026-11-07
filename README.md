# AryanStreams Media Relay & Player (`as-proxy`)

High-Speed Universal CORS Media Relay & Video Player Hub designed for **Lovable** (`https://lovable.dev`).

---

## ⚡ Features:
1. **Universal Media Relay (`/api/proxy?u=...`)**:
   - Zero-buffer streaming with low latency Time-To-First-Byte (TTFB).
   - Standard CORS headers (`Access-Control-Allow-Origin: *`) for open web video players.
   - Dynamic M3U8 multi-variant and media playlist rewriting to route all `.ts` / `.m4s` chunks through the relay.
   - Embed friendly: Allows embedding in modern web frames and dashboards.
2. **Interactive Live Player Dashboard**:
   - Responsive video player with HLS streaming support.
   - Demo broadcast feeds (1080p open HLS streams).
   - Universal URL Relay Generator with 1-click clipboard copy.
   - Upstream latency ping tester.
3. **Lovable & Supabase Ready**:
   - Deploys seamlessly on **Lovable.dev** connected to this repository (`ARYANBHAIcool/as-proxy`).
   - Dual-engine: Native Nitro/Cloudflare edge server handler (`src/server.ts`) + Supabase Edge Functions (`supabase/functions/px` & `supabase/functions/proxy`).

---

## 🚀 How to Connect to Lovable:
1. Log in to [Lovable.dev](https://lovable.dev).
2. Click **Upload Code** (Upload ZIP) and select `as-proxy.zip`, or connect repository **`ARYANBHAIcool/as-proxy`**.
3. Lovable will immediately install dependencies, build the preview, and deploy your live relay!
4. Your dedicated relay endpoint will be live at:
   ```
   https://<your-project>.lovable.app/api/proxy?u=<STREAM_OR_M3U8_URL>
   ```

---

## 📡 API Usage:

### 1. Standard Relay:
```http
GET /api/proxy?u=https%3A%2F%2Ftest-streams.mux.dev%2Fx36xhzz%2Fx36xhzz.m3u8
```

### 2. Short Route:
```http
GET /proxy?u=<ENCODED_STREAM_URL>
```

### 3. Supabase Edge Function Route:
```http
GET /api/public/px?url=<ENCODED_STREAM_URL>
```
