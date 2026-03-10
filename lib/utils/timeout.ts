import { AppError } from "@/lib/errors";

/**
 * Race a promise against a timeout. Rejects with SERVICE_UNAVAILABLE
 * if the promise does not resolve within `ms` milliseconds.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AppError({ code: "SERVICE_UNAVAILABLE", message: `${label} timed out after ${ms}ms` })),
      ms,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
