import { handleCategoryFilePost, handleCategoryFileDelete } from "@/lib/api/categoryFileHandler";

const CATEGORY = "workshops" as const;

export async function POST(request: Request) {
  return handleCategoryFilePost(request, CATEGORY);
}

export async function DELETE(request: Request) {
  return handleCategoryFileDelete(request, CATEGORY);
}
