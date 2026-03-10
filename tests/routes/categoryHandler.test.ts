import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiSuccess,
  apiPaginated,
  apiError,
  apiErrorFromCatch,
  parsePagination,
  paginate,
} from "@/lib/api/response";
import { AppError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Response envelope — apiSuccess
// ---------------------------------------------------------------------------

describe("apiSuccess", () => {
  it("returns 200 by default with success envelope", async () => {
    const response = apiSuccess({ id: "abc" });
    assert.equal(response.status, 200);
    const body = await parseBody(response);
    assert.equal(body.success, true);
    assert.deepEqual(body.data, { id: "abc" });
    assert.equal(body.error, null);
  });

  it("accepts custom status code", async () => {
    const response = apiSuccess({ created: true }, 201);
    assert.equal(response.status, 201);
  });

  it("includes meta with timestamp", async () => {
    const response = apiSuccess({ ok: true });
    const body = await parseBody(response);
    const meta = body.meta as Record<string, unknown>;
    assert.ok(meta);
    assert.ok(typeof meta.timestamp === "string");
  });
});

// ---------------------------------------------------------------------------
// Response envelope — apiPaginated
// ---------------------------------------------------------------------------

describe("apiPaginated", () => {
  it("returns paginated response with items and pagination meta", async () => {
    const items = [{ id: "1" }, { id: "2" }];
    const response = apiPaginated(items, {
      total: 10,
      page: 1,
      pageSize: 2,
      totalPages: 5,
    });
    assert.equal(response.status, 200);
    const body = await parseBody(response);
    assert.equal(body.success, true);
    const data = body.data as unknown[];
    assert.equal(data.length, 2);
    const pagination = body.pagination as Record<string, unknown>;
    assert.equal(pagination.total, 10);
    assert.equal(pagination.page, 1);
    assert.equal(pagination.pageSize, 2);
    assert.equal(pagination.totalPages, 5);
  });

  it("returns empty array for no items", async () => {
    const response = apiPaginated([], {
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    const body = await parseBody(response);
    const data = body.data as unknown[];
    assert.equal(data.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Response envelope — apiError
// ---------------------------------------------------------------------------

describe("apiError", () => {
  it("returns error envelope with correct HTTP status for NOT_FOUND", async () => {
    const response = apiError("Not found", "NOT_FOUND");
    assert.equal(response.status, 404);
    const body = await parseBody(response);
    assert.equal(body.success, false);
    assert.equal(body.data, null);
    const error = body.error as Record<string, unknown>;
    assert.equal(error.message, "Not found");
    assert.equal(error.code, "NOT_FOUND");
  });

  it("returns 400 for VALIDATION_ERROR", async () => {
    const response = apiError("Invalid input", "VALIDATION_ERROR");
    assert.equal(response.status, 400);
  });

  it("returns 403 for FORBIDDEN", async () => {
    const response = apiError("Forbidden", "FORBIDDEN");
    assert.equal(response.status, 403);
  });

  it("returns 429 for RATE_LIMITED", async () => {
    const response = apiError("Too many requests", "RATE_LIMITED");
    assert.equal(response.status, 429);
  });

  it("returns 500 for UNKNOWN code by default", async () => {
    const response = apiError("Something broke");
    assert.equal(response.status, 500);
    const body = await parseBody(response);
    const error = body.error as Record<string, unknown>;
    assert.equal(error.code, "UNKNOWN");
  });
});

// ---------------------------------------------------------------------------
// Response envelope — apiErrorFromCatch
// ---------------------------------------------------------------------------

describe("apiErrorFromCatch", () => {
  it("handles AppError with correct status", async () => {
    const error = new AppError({ code: "VALIDATION_ERROR", message: "Bad input" });
    const response = apiErrorFromCatch(error);
    assert.equal(response.status, 400);
    const body = await parseBody(response);
    const errObj = body.error as Record<string, unknown>;
    assert.equal(errObj.message, "Bad input");
    assert.equal(errObj.code, "VALIDATION_ERROR");
  });

  it("handles plain Error", async () => {
    const response = apiErrorFromCatch(new Error("oops"));
    const body = await parseBody(response);
    assert.equal(body.success, false);
    const errObj = body.error as Record<string, unknown>;
    assert.ok(errObj.message);
  });

  it("handles string error", async () => {
    const response = apiErrorFromCatch("raw error");
    const body = await parseBody(response);
    assert.equal(body.success, false);
  });

  it("handles null/undefined with fallback message", async () => {
    const response = apiErrorFromCatch(null, "Fallback");
    const body = await parseBody(response);
    assert.equal(body.success, false);
  });

  it("maps PAYLOAD_TOO_LARGE to 413", async () => {
    const error = new AppError({ code: "PAYLOAD_TOO_LARGE", message: "Too big" });
    const response = apiErrorFromCatch(error);
    assert.equal(response.status, 413);
  });
});

// ---------------------------------------------------------------------------
// parsePagination
// ---------------------------------------------------------------------------

describe("parsePagination", () => {
  it("returns defaults for null params", () => {
    const result = parsePagination(null);
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 50);
  });

  it("parses page and pageSize from search params", () => {
    const params = new URLSearchParams("page=3&pageSize=10");
    const result = parsePagination(params);
    assert.equal(result.page, 3);
    assert.equal(result.pageSize, 10);
  });

  it("clamps page to minimum 1 for zero", () => {
    const params = new URLSearchParams("page=0");
    const result = parsePagination(params);
    assert.equal(result.page, 1);
  });

  it("clamps negative page to 1", () => {
    const params = new URLSearchParams("page=-5");
    const result = parsePagination(params);
    assert.equal(result.page, 1);
  });

  it("clamps pageSize to maximum 100", () => {
    const params = new URLSearchParams("pageSize=500");
    const result = parsePagination(params);
    assert.equal(result.pageSize, 100);
  });

  it("accepts custom defaults", () => {
    const result = parsePagination(null, { pageSize: 25 });
    assert.equal(result.pageSize, 25);
  });

  it("handles non-numeric page as 1", () => {
    const params = new URLSearchParams("page=abc");
    const result = parsePagination(params);
    assert.equal(result.page, 1);
  });

  it("handles non-numeric pageSize as default", () => {
    const params = new URLSearchParams("pageSize=xyz");
    const result = parsePagination(params);
    assert.equal(result.pageSize, 50);
  });
});

// ---------------------------------------------------------------------------
// paginate
// ---------------------------------------------------------------------------

describe("paginate", () => {
  it("returns correct slice for page 2", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }));
    const result = paginate(items, 2, 3);
    assert.equal(result.data.length, 3);
    assert.equal(result.data[0].id, "3");
    assert.equal(result.pagination.total, 10);
    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.totalPages, 4);
  });

  it("clamps page beyond total to last page", () => {
    const items = [{ id: "1" }];
    const result = paginate(items, 5, 10);
    assert.equal(result.data.length, 1);
    assert.equal(result.pagination.page, 1);
  });

  it("returns all for single page", () => {
    const items = [{ id: "1" }, { id: "2" }];
    const result = paginate(items, 1, 50);
    assert.equal(result.data.length, 2);
    assert.equal(result.pagination.totalPages, 1);
  });

  it("handles empty array", () => {
    const result = paginate([], 1, 10);
    assert.equal(result.data.length, 0);
    assert.equal(result.pagination.total, 0);
    assert.equal(result.pagination.totalPages, 1);
  });

  it("last page has remainder items", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: String(i) }));
    const result = paginate(items, 3, 3);
    assert.equal(result.data.length, 1);
    assert.equal(result.pagination.totalPages, 3);
  });
});
