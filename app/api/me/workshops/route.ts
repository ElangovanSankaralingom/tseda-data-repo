import { demoAware } from "@/lib/demo/demoAware";
import { type NextRequest } from "next/server";
import {
  handleCategoryGet,
  handleCategoryPost,
  handleCategoryPatch,
  handleCategoryDelete,
} from "@/lib/api/categoryRouteHandler";

const CATEGORY = "workshops" as const;

async function GETHandler(req: NextRequest) {
  return handleCategoryGet(req, CATEGORY);
}

async function POSTHandler(req: NextRequest) {
  return handleCategoryPost(req, CATEGORY);
}

async function PATCHHandler(req: NextRequest) {
  return handleCategoryPatch(req, CATEGORY);
}

async function DELETEHandler(req: NextRequest) {
  return handleCategoryDelete(req, CATEGORY);
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const POST = demoAware(POSTHandler);
export const PATCH = demoAware(PATCHHandler);
export const DELETE = demoAware(DELETEHandler);
