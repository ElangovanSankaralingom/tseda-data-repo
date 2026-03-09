import { type NextRequest } from "next/server";
import {
  handleCategoryGet,
  handleCategoryPost,
  handleCategoryPatch,
  handleCategoryDelete,
} from "@/lib/api/categoryRouteHandler";

const CATEGORY = "guest-lectures" as const;

export async function GET(req: NextRequest) {
  return handleCategoryGet(req, CATEGORY);
}

export async function POST(req: NextRequest) {
  return handleCategoryPost(req, CATEGORY);
}

export async function PATCH(req: NextRequest) {
  return handleCategoryPatch(req, CATEGORY);
}

export async function DELETE(req: NextRequest) {
  return handleCategoryDelete(req, CATEGORY);
}
