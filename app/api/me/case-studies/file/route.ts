import { demoAware } from "@/lib/demo/demoAware";
import { handleCategoryFilePost, handleCategoryFileDelete } from "@/lib/api/categoryFileHandler";

const CATEGORY = "case-studies" as const;

async function POSTHandler(request: Request) {
  return handleCategoryFilePost(request, CATEGORY);
}

async function DELETEHandler(request: Request) {
  return handleCategoryFileDelete(request, CATEGORY);
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const POST = demoAware(POSTHandler);
export const DELETE = demoAware(DELETEHandler);
