import { CATEGORY_LIST, isValidCategorySlug } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";

type RouterLike = {
  back: () => void;
  push: (href: string) => void;
};

const CATEGORY_SET = new Set<CategoryKey>(CATEGORY_LIST);

export function normalizeCategory(category: string): CategoryKey {
  const normalized = category.trim().toLowerCase();
  if (isValidCategorySlug(normalized) && CATEGORY_SET.has(normalized)) {
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

export function adminAudit() {
  return "/admin/audit";
}

export function adminExport() {
  return "/admin/export";
}

export function adminBackups() {
  return "/admin/backups";
}

export function adminIntegrity() {
  return "/admin/integrity";
}

export function adminIntegrityUser(userEmail: string) {
  return `/admin/integrity/${encodeURIComponent(userEmail)}`;
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
