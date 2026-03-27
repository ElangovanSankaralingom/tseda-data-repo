export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? json) as T;
}
