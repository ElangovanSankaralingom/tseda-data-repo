import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateCsrf } from "../../lib/security/csrf.ts";
import { rateLimit, type RateLimitOptions } from "../../lib/security/rateLimit.ts";
import { sanitizeEntryFields } from "../../lib/security/sanitize.ts";
import {
  validateMimeType,
  validateFileSize,
  validateMagicBytes,
  sanitizeFilename,
} from "../../lib/security/fileValidation.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, origin?: string): Request {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new Request("http://localhost:3000/api/test", { method, headers });
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

describe("validateCsrf", () => {
  it("allows GET requests regardless of origin", () => {
    const result = validateCsrf(makeRequest("GET", "https://evil.com"));
    assert.equal(result, null);
  });

  it("allows POST with no origin header (same-origin)", () => {
    const result = validateCsrf(makeRequest("POST"));
    assert.equal(result, null);
  });

  it("allows POST with localhost origin in dev", () => {
    const result = validateCsrf(makeRequest("POST", "http://localhost:3000"));
    assert.equal(result, null);
  });

  it("rejects POST with cross-origin header", () => {
    const result = validateCsrf(makeRequest("POST", "https://evil.com"));
    assert.ok(result);
    assert.ok(result.includes("evil.com"));
  });

  it("rejects PATCH with cross-origin header", () => {
    const result = validateCsrf(makeRequest("PATCH", "https://evil.com"));
    assert.ok(result);
  });

  it("rejects DELETE with cross-origin header", () => {
    const result = validateCsrf(makeRequest("DELETE", "https://evil.com"));
    assert.ok(result);
  });

  it("rejects PUT with cross-origin header", () => {
    const result = validateCsrf(makeRequest("PUT", "https://evil.com"));
    assert.ok(result);
  });
});

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

describe("rateLimit", () => {
  const opts: RateLimitOptions = { windowMs: 60_000, max: 3 };

  it("allows requests under the limit", () => {
    const key = `test-under-${Date.now()}-${Math.random()}`;
    const r1 = rateLimit(key, opts);
    assert.equal(r1.ok, true);
    const r2 = rateLimit(key, opts);
    assert.equal(r2.ok, true);
  });

  it("rejects requests over the limit", () => {
    const key = `test-over-${Date.now()}-${Math.random()}`;
    rateLimit(key, opts);
    rateLimit(key, opts);
    rateLimit(key, opts);
    const result = rateLimit(key, opts);
    assert.equal(result.ok, false);
  });

  it("returns RATE_LIMITED error code when exceeded", () => {
    const key = `test-code-${Date.now()}-${Math.random()}`;
    rateLimit(key, opts);
    rateLimit(key, opts);
    rateLimit(key, opts);
    const result = rateLimit(key, opts);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "RATE_LIMITED");
    }
  });

  it("rejects empty key", () => {
    const result = rateLimit("", opts);
    assert.equal(result.ok, false);
  });

  it("rejects invalid window", () => {
    const key = `test-window-${Date.now()}`;
    const result = rateLimit(key, { windowMs: -1, max: 5 });
    assert.equal(result.ok, false);
  });

  it("rejects invalid max", () => {
    const key = `test-max-${Date.now()}`;
    const result = rateLimit(key, { windowMs: 60_000, max: 0 });
    assert.equal(result.ok, false);
  });
});

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

describe("sanitizeEntryFields", () => {
  it("strips HTML tags from string fields", () => {
    const result = sanitizeEntryFields({
      title: "Hello <script>alert('xss')</script>World",
    });
    assert.equal(result.title, "Hello alert('xss')World");
  });

  it("removes null bytes", () => {
    const result = sanitizeEntryFields({
      name: "Hello\0World",
    });
    assert.equal(result.name, "HelloWorld");
  });

  it("trims whitespace", () => {
    const result = sanitizeEntryFields({
      name: "  Hello  ",
    });
    assert.equal(result.name, "Hello");
  });

  it("truncates long strings", () => {
    const longStr = "a".repeat(10_000);
    const result = sanitizeEntryFields({ name: longStr });
    assert.ok((result.name as string).length <= 5_000);
  });

  it("preserves non-string fields", () => {
    const result = sanitizeEntryFields({
      count: 42,
      active: true,
      nested: { name: "<b>test</b>" },
    });
    assert.equal(result.count, 42);
    assert.equal(result.active, true);
    assert.equal((result.nested as Record<string, unknown>).name, "test");
  });

  it("skips safe keys like id and ownerEmail", () => {
    const result = sanitizeEntryFields({
      id: "abc-123",
      ownerEmail: "user@tce.edu",
      createdAt: "2024-01-01T00:00:00Z",
    });
    assert.equal(result.id, "abc-123");
    assert.equal(result.ownerEmail, "user@tce.edu");
    assert.equal(result.createdAt, "2024-01-01T00:00:00Z");
  });

  it("handles arrays", () => {
    const result = sanitizeEntryFields({
      tags: ["<em>one</em>", "two"],
    });
    const tags = result.tags as string[];
    assert.equal(tags[0], "one");
    assert.equal(tags[1], "two");
  });
});

// ---------------------------------------------------------------------------
// File Validation
// ---------------------------------------------------------------------------

describe("validateMimeType", () => {
  it("allows application/pdf", () => {
    const result = validateMimeType("application/pdf");
    assert.equal(result.valid, true);
  });

  it("allows image/png", () => {
    const result = validateMimeType("image/png");
    assert.equal(result.valid, true);
  });

  it("allows image/jpeg", () => {
    const result = validateMimeType("image/jpeg");
    assert.equal(result.valid, true);
  });

  it("rejects text/html", () => {
    const result = validateMimeType("text/html");
    assert.equal(result.valid, false);
  });

  it("rejects application/javascript", () => {
    const result = validateMimeType("application/javascript");
    assert.equal(result.valid, false);
  });
});

describe("validateFileSize", () => {
  it("allows 1MB file", () => {
    const result = validateFileSize(1_000_000);
    assert.equal(result.valid, true);
  });

  it("rejects file over 10MB", () => {
    const result = validateFileSize(11_000_000);
    assert.equal(result.valid, false);
  });

  it("rejects empty file", () => {
    const result = validateFileSize(0);
    assert.equal(result.valid, false);
  });

  it("rejects negative size", () => {
    const result = validateFileSize(-1);
    assert.equal(result.valid, false);
  });
});

describe("validateMagicBytes", () => {
  it("validates PDF magic bytes", () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
    const result = validateMagicBytes(pdfBytes, "application/pdf");
    assert.equal(result.valid, true);
  });

  it("validates PNG magic bytes", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = validateMagicBytes(pngBytes, "image/png");
    assert.equal(result.valid, true);
  });

  it("validates JPEG magic bytes", () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const result = validateMagicBytes(jpegBytes, "image/jpeg");
    assert.equal(result.valid, true);
  });

  it("rejects wrong magic bytes for PDF", () => {
    const notPdf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const result = validateMagicBytes(notPdf, "application/pdf");
    assert.equal(result.valid, false);
  });

  it("rejects unknown MIME type", () => {
    const bytes = new Uint8Array([0x00, 0x00]);
    const result = validateMagicBytes(bytes, "text/plain");
    assert.equal(result.valid, false);
  });
});

describe("sanitizeFilename", () => {
  it("removes path traversal", () => {
    assert.equal(sanitizeFilename("../../etc/passwd"), "etcpasswd");
  });

  it("removes slashes", () => {
    assert.equal(sanitizeFilename("path/to/file.pdf"), "pathtofile.pdf");
  });

  it("removes null bytes", () => {
    assert.equal(sanitizeFilename("file\0.pdf"), "file.pdf");
  });

  it("removes leading dots", () => {
    assert.equal(sanitizeFilename(".hidden"), "hidden");
  });

  it("returns 'file' for empty input", () => {
    assert.equal(sanitizeFilename(""), "file");
  });

  it("truncates overly long names", () => {
    const long = "a".repeat(300) + ".pdf";
    const result = sanitizeFilename(long);
    assert.ok(result.length <= 200);
    assert.ok(result.endsWith(".pdf"));
  });
});
