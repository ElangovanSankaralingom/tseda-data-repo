import useSWR, { type SWRConfiguration } from "swr";
import { apiFetcher } from "@/lib/swr/fetcher";

/**
 * Thin wrapper over useSWR with project defaults.
 * Pass `null` as url to conditionally skip fetching.
 */
export function useApi<T = unknown>(url: string | null, options?: SWRConfiguration<T>) {
  return useSWR<T>(url, apiFetcher<T>, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    ...options,
  });
}
