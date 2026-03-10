/**
 * Next.js instrumentation hook.
 *
 * Validates environment variables and registers global process error
 * handlers + graceful shutdown on the Node.js runtime.
 */
export async function register() {
  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupGracefulShutdown } = await import("@/lib/server/shutdown");

    process.on("unhandledRejection", (reason) => {
      console.error(
        JSON.stringify({
          level: "error",
          ts: new Date().toISOString(),
          event: "process.unhandledRejection",
          message: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined,
        }),
      );
    });

    process.on("uncaughtException", (error) => {
      console.error(
        JSON.stringify({
          level: "error",
          ts: new Date().toISOString(),
          event: "process.uncaughtException",
          message: error.message,
          stack: error.stack,
        }),
      );
      process.exit(1);
    });

    setupGracefulShutdown();
  }
}
