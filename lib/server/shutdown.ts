let isShuttingDown = false;

export function isServerShuttingDown() {
  return isShuttingDown;
}

export function setupGracefulShutdown() {
  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.info(
      JSON.stringify({
        level: "info",
        ts: new Date().toISOString(),
        event: "server.shutdown",
        signal,
      }),
    );

    // Force exit after 5s if graceful shutdown hangs
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
