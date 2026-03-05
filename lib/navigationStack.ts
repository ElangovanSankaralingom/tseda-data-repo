import { dataEntryHome } from "@/lib/navigation";

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
