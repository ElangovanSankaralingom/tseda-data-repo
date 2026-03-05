import type { CategoryKey } from "@/lib/entries/types";

type RouterLike = {
  back: () => void;
  push: (href: string) => void;
};

const CATEGORY_SET = new Set<CategoryKey>([
  "fdp-attended",
  "fdp-conducted",
  "case-studies",
  "guest-lectures",
  "workshops",
]);

export function normalizeCategory(category: string): CategoryKey {
  const normalized = category.trim().toLowerCase();
  if (CATEGORY_SET.has(normalized as CategoryKey)) {
    return normalized as CategoryKey;
  }
  throw new Error(`Unsupported category: ${category}`);
}

export function dashboard() {
  return "/dashboard";
}

export function dataEntryHome() {
  return "/data-entry";
}

export function profile() {
  return "/account";
}

export function signin() {
  return "/signin";
}

export function adminHome() {
  return "/admin";
}

export function adminConfirmations() {
  return "/admin/confirmations";
}

export function adminUsers() {
  return "/admin/users";
}

export function adminSettings() {
  return "/admin/settings";
}

export function entryList(category: CategoryKey) {
  return `${dataEntryHome()}/${category}`;
}

export function entryNew(category: CategoryKey) {
  return `${entryList(category)}/new`;
}

export function entryDetail(category: CategoryKey, id: string) {
  return `${entryList(category)}/${encodeURIComponent(id)}`;
}

export function safeBack(router: RouterLike, fallbackUrl: string) {
  if (typeof window === "undefined") {
    router.push(fallbackUrl);
    return;
  }

  const referrer = document.referrer;
  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const sameOrigin = referrerUrl.origin === window.location.origin;
      const samePath = referrerUrl.pathname === window.location.pathname;

      if (sameOrigin && !samePath) {
        router.back();
        return;
      }
    } catch {
      // Ignore parse failures and use fallback push.
    }
  }

  router.push(fallbackUrl);
}
