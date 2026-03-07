import { CATEGORY_LIST, isValidCategorySlug } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";

type RouterLike = {
  back: () => void;
  push: (href: string) => void;
  replace?: (href: string) => void;
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

export function dataEntrySearch() {
  return "/data-entry/search";
}

export function helpHome() {
  return "/help";
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

export function adminBackupsDownload(filename?: string) {
  const base = `${adminBackups()}/download`;
  return filename ? `${base}?filename=${encodeURIComponent(filename)}` : base;
}

export function adminBackupsCreate() {
  return `${adminBackups()}/create`;
}

export function adminMaintenance() {
  return "/admin/maintenance";
}

export function adminIntegrity() {
  return "/admin/integrity";
}

export function adminSearch() {
  return "/admin/search";
}

export function adminAnalytics() {
  return "/admin/analytics";
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

export function entryPreview(category: CategoryKey, id: string) {
  return `${entryDetail(category, id)}/preview`;
}

export function safeBack(router: RouterLike, fallbackUrl: string) {
  if (typeof window === "undefined") {
    if (typeof router.replace === "function") {
      router.replace(fallbackUrl);
      return;
    }
    router.push(fallbackUrl);
    return;
  }

  const referrer = document.referrer;
  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const sameOrigin = referrerUrl.origin === window.location.origin;
      const fallbackPath = new URL(fallbackUrl, window.location.origin).pathname;
      const referrerMatchesFallback = referrerUrl.pathname === fallbackPath;

      if (sameOrigin && referrerMatchesFallback) {
        router.back();
        return;
      }
    } catch {
      // Ignore parse failures and use fallback navigation.
    }
  }

  if (typeof router.replace === "function") {
    router.replace(fallbackUrl);
    return;
  }

  router.push(fallbackUrl);
}

export function getCategoryNavigation(categoryPath: string, viewEntryId?: string) {
  const isPreviewMode = Boolean(viewEntryId);
  const dataEntryHref = dataEntryHome();

  return {
    isPreviewMode,
    dataEntryHref,
    categoryHref: categoryPath,
    backHref: isPreviewMode ? categoryPath : dataEntryHref,
    backDisabled: false,
  };
}

export function getDataEntryNavigation() {
  return {
    backHref: dataEntryHome(),
    backDisabled: true,
  };
}
