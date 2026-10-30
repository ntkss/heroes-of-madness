"use client"; // Error boundaries must be Client Components

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#050508",
          color: "white",
          fontFamily: "monospace",
          padding: "24px",
          gap: "24px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <h2
            style={{
              fontSize: "28px",
              fontWeight: 900,
              color: "#f87171",
              marginBottom: "16px",
            }}
          >
            ⚠️ CRITICAL SYSTEM ERROR
          </h2>
          <p style={{ fontSize: "13px", color: "#94a3b8" }}>
            The application encountered a critical error. Please try again.
          </p>
          <p
            style={{
              fontSize: "10px",
              color: "#475569",
              wordBreak: "break-all",
              marginTop: "8px",
            }}
          >
            {error?.message || "Unknown error"}
          </p>
        </div>
        <button
          onClick={() => unstable_retry()}
          style={{
            border: "2px solid #facc15",
            backgroundColor: "rgba(250, 204, 21, 0.1)",
            color: "#facc15",
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: "bold",
            letterSpacing: "2px",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          ⚡ RETRY
        </button>
      </body>
    </html>
  );
}
