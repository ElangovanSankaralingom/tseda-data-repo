import { logger } from "@/lib/logger";

/**
 * Safely handle fire-and-forget promises by catching and logging errors.
 *
 * Use this instead of bare `void somePromise()` to ensure errors are
 * always logged rather than silently swallowed.
 */
export function fireAndForget(promise: Promise<unknown>, label: string) {
  promise.catch((error) => {
    logger.error({
      event: "fire_and_forget.error",
      label,
    }, error instanceof Error ? error.message : String(error));
  });
}
