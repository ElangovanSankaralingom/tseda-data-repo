export function getCategoryNavigation(categoryPath: string, viewEntryId?: string) {
  const isPreviewMode = Boolean(viewEntryId);

  return {
    isPreviewMode,
    dataEntryHref: "/data-entry",
    categoryHref: categoryPath,
    backHref: isPreviewMode ? categoryPath : "/data-entry",
    backDisabled: false,
  };
}

export function getDataEntryNavigation() {
  return {
    backHref: "/data-entry",
    backDisabled: true,
  };
}
