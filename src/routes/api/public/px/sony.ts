import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/px/sony")({
  server: { handlers: {
    GET: async ({ request }) => (await import("@/lib/stream-proxy.server")).handleProxy(request),
    HEAD: async ({ request }) => (await import("@/lib/stream-proxy.server")).handleProxy(request),
    OPTIONS: async ({ request }) => (await import("@/lib/stream-proxy.server")).handleProxy(request),
  } },
});
