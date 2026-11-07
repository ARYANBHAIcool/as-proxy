import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Play,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AryanStreams — Universal Edge Media Relay & Player" },
      {
        name: "description",
        content: "High-performance HLS video player and CORS media relay with M3U8 rewriting.",
      },
      { property: "og:title", content: "AryanStreams — Universal Edge Media Relay & Player" },
      {
        property: "og:description",
        content: "Fast media relay and player hub.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProxyDashboard,
});

const DEFAULT_CHANNELS = [
  {
    id: "bbb",
    name: "Live Broadcast 1 (1080p)",
    category: "HLS Feed",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  },
  {
    id: "tos",
    name: "Sports Arena Feed 2",
    category: "Adaptive Bitrate",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
  },
  {
    id: "sintel",
    name: "Broadcast Channel 3",
    category: "Multi-Audio HLS",
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
  },
  {
    id: "redbull",
    name: "Action Sports Live 4",
    category: "Live Stream",
    url: "https://playertest.longtailvideo.com/adaptive/oceans_aes/oceans_aes.m3u8",
  },
  {
    id: "nasatv",
    name: "Global Stream 5",
    category: "Continuous 24/7",
    url: "https://content.uplynk.com/channel/3324f2467c414329b3b0cc30e07505d2.m3u8",
  },
];

function ProxyDashboard() {
  const [selectedChannel, setSelectedChannel] = useState(DEFAULT_CHANNELS[0]);
  const [inputUrl, setInputUrl] = useState(DEFAULT_CHANNELS[0].url);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"player" | "generator" | "api">("player");
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [originUrl, setOriginUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginUrl(window.location.origin);
    }
  }, []);

  const proxiedUrl = `${originUrl}/api/proxy?u=${encodeURIComponent(inputUrl)}`;

  const loadStream = (url: string) => {
    const video = videoRef.current;
    if (!video) return;

    const playUrl = `${originUrl}/api/proxy?u=${encodeURIComponent(url)}`;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playUrl;
      video.play().catch(() => {});
    } else if (typeof window !== "undefined") {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 60,
            });
            hls.loadSource(playUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(() => {});
            });
          } else {
            video.src = playUrl;
            video.play().catch(() => {});
          }
        })
        .catch(() => {
          video.src = playUrl;
          video.play().catch(() => {});
        });
    }
  };

  const handleChannelSelect = (ch: typeof DEFAULT_CHANNELS[0]) => {
    setSelectedChannel(ch);
    setInputUrl(ch.url);
    loadStream(ch.url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(proxiedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePingTest = async () => {
    setPingLoading(true);
    setPingStatus("Testing...");
    const start = performance.now();
    try {
      const res = await fetch(`/api/proxy?u=${encodeURIComponent(inputUrl)}`, {
        method: "HEAD",
      });
      const duration = Math.round(performance.now() - start);
      setPingStatus(`${res.status} OK (${duration}ms)`);
    } catch (err: any) {
      setPingStatus(`Error: ${err?.message || "Failed"}`);
    } finally {
      setPingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 font-bold text-zinc-950 shadow-lg shadow-emerald-500/20">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  AryanStreams
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Media Relay v2.1
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">Universal High-Performance Media Relay & Player Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>CORS: Enabled</span>
              <span className="text-zinc-600">|</span>
              <Server className="size-3.5 text-cyan-400" />
              <span>Edge Streaming</span>
            </div>
            <a
              href="https://github.com/ARYANBHAIcool/as-proxy"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors border border-zinc-700"
            >
              <ExternalLink className="size-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4 mb-6">
          <Button
            variant={activeTab === "player" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("player")}
            className="gap-2"
          >
            <Radio className="size-4" />
            Live Player
          </Button>
          <Button
            variant={activeTab === "generator" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("generator")}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            Relay Generator
          </Button>
          <Button
            variant={activeTab === "api" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("api")}
            className="gap-2"
          >
            <Terminal className="size-4" />
            API & Integration
          </Button>
        </div>

        {/* Tab 1: Live Player & Channels */}
        {activeTab === "player" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-zinc-800 shadow-2xl">
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-base text-zinc-100">{selectedChannel.name}</h2>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 font-medium">
                      {selectedChannel.category}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 truncate max-w-md">
                    {proxiedUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 text-xs">
                    {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy Stream URL"}
                  </Button>
                  <Button size="sm" onClick={() => loadStream(inputUrl)} className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs">
                    <Play className="size-3.5 fill-current" />
                    Play Stream
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-zinc-300 flex items-center gap-2">
                <Flame className="size-4 text-emerald-400" />
                Channels & Feeds
              </h3>
              <div className="space-y-2">
                {DEFAULT_CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleChannelSelect(ch)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedChannel.id === ch.id
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-sm"
                        : "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/60 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{ch.name}</span>
                      <span className="text-[11px] text-zinc-500">{ch.category}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400 space-y-2">
                <div className="font-medium text-zinc-200">High-Performance Relay:</div>
                <p>
                  Zero memory buffering on video segments. Supports HLS (.m3u8), TS chunks, and DASH manifests.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Universal Proxy Generator */}
        {activeTab === "generator" && (
          <div className="max-w-3xl space-y-6">
            <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <Globe className="size-5 text-emerald-400" />
                  Universal Media Relay Generator
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Relay any HLS (.m3u8), TS segment, or media stream URL with CORS headers.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Target Stream / M3U8 URL:</label>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Generated Relayed URL:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={proxiedUrl}
                    className="w-full rounded-xl bg-zinc-950/80 border border-zinc-800/80 px-4 py-2.5 text-xs text-emerald-400 font-mono focus:outline-none"
                  />
                  <Button onClick={handleCopy} className="gap-1.5 shrink-0 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold">
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePingTest}
                  disabled={pingLoading}
                  className="gap-2 text-xs"
                >
                  <RefreshCw className={`size-3.5 ${pingLoading ? "animate-spin" : ""}`} />
                  Test Upstream Latency
                </Button>
                {pingStatus && (
                  <span className="text-xs font-mono font-medium text-zinc-300 bg-zinc-800/60 px-3 py-1.5 rounded-lg border border-zinc-700">
                    {pingStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: API Docs */}
        {activeTab === "api" && (
          <div className="max-w-4xl space-y-6">
            <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-6 space-y-4">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Terminal className="size-5 text-emerald-400" />
                API Endpoints & Integration Guide
              </h2>
              <p className="text-sm text-zinc-400">
                Use this media relay in web players or mobile applications.
              </p>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
                  <div className="text-emerald-400 font-semibold">Endpoint 1 (Standard):</div>
                  <div>GET /api/proxy?u=&lt;TARGET_URL&gt;&amp;referer=&lt;OPTIONAL_REFERER&gt;</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
                  <div className="text-cyan-400 font-semibold">Endpoint 2 (Short):</div>
                  <div>GET /proxy?u=&lt;TARGET_URL&gt;</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
                  <div className="text-purple-400 font-semibold">Endpoint 3 (Supabase Function):</div>
                  <div>GET /api/public/px?url=&lt;TARGET_URL&gt;</div>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <h4 className="font-semibold text-sm text-zinc-200">Integration with HLS.js:</h4>
                <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono overflow-x-auto">
{`const hls = new Hls();
const streamUrl = "${originUrl}/api/proxy?u=" + encodeURIComponent("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");

hls.loadSource(streamUrl);
hls.attachMedia(document.getElementById("video-element"));`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
