# AryanStreams Edge Proxy (`as-proxy`)

High-Speed Universal Stream Proxy & Live Player Hub designed for **Lovable** (`https://lovable.dev`).

---

## ⚡ Features:
1. **Universal Stream Proxy (`/api/proxy?u=...`)**:
   - Zero-buffer streaming with instant Time-To-First-Byte (TTFB).
   - Akamai CDN & SonyLiv header spoofing (`dishmt.slivcdn.com` with `Referer: https://www.sonyliv.com/`).
   - FanCode & JioTV user-agent / origin spoofing.
   - Dynamic M3U8 multi-variant and child playlist rewriting to route all `.ts` / `.m4s` segments through the proxy.
   - Strips `X-Frame-Options` and `Content-Security-Policy` to enable embedding in any iframe or player.
2. **Built-in Live Player Dashboard**:
   - Interactive HLS video player with low latency mode.
   - Live sports channel presets (Sony TEN 1-5 HD, FanCode live feeds).
   - Universal URL Proxy Generator with 1-click clipboard copy.
   - Real-time upstream latency ping tester.
3. **Lovable & Supabase Ready**:
   - Deploys seamlessly on **Lovable.dev** connected to this repository (`ARYANBHAIcool/as-proxy`).
   - Dual-engine: Native Nitro/Cloudflare edge server handler (`src/server.ts`) + Supabase Edge Functions (`supabase/functions/px` & `supabase/functions/proxy`).

---

## 🚀 How to Connect to Lovable:
1. Log in to [Lovable.dev](https://lovable.dev).
2. Click **Create Project** or **Import from GitHub**.
3. Select your repository: **`ARYANBHAIcool/as-proxy`**.
4. Lovable will automatically install dependencies, build the preview, and deploy your live proxy!
5. Your dedicated proxy endpoint will be live at:
   ```
   https://<your-project>.lovable.app/api/proxy?u=<STREAM_OR_M3U8_URL>
   ```

---

## 📡 API Usage:

### 1. Standard Proxy (Recommended):
```http
GET /api/proxy?u=https%3A%2F%2Fdishmt.slivcdn.com%2Fhls%2Flive%2F2011747%2FTEN1HD%2Fmaster.m3u8%3F...
```

### 2. Short Route:
```http
GET /proxy?u=<ENCODED_STREAM_URL>
```

### 3. Supabase Edge Function Route:
```http
GET /api/public/px?url=<ENCODED_STREAM_URL>
```
