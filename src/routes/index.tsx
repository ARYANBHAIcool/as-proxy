import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Service Status" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HeadlessStatus,
});

function HeadlessStatus() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      backgroundColor: "#09090b",
      color: "#a1a1aa",
      fontFamily: "monospace",
      fontSize: "14px"
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#22c55e", fontWeight: "bold", marginBottom: "4px" }}>● SYSTEM OPERATIONAL</p>
        <p style={{ margin: 0, fontSize: "12px", color: "#71717a" }}>Relay Engine Active • Ready for Requests</p>
      </div>
    </div>
  );
}
