import { test } from "node:test";
import assert from "node:assert/strict";
import { getRequestIp } from "@/lib/security/rateLimit";

// 2026-07 audit hardening: x-forwarded-for keying must not be trivially
// spoofable. Behind a proxy the RIGHTMOST entry is proxy-appended (trustable);
// the first entry is client-supplied.

test("getRequestIp uses the rightmost x-forwarded-for entry", () => {
  const req = new Request("http://localhost/api/x", {
    headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.7" },
  });
  assert.equal(getRequestIp(req), "203.0.113.7");
});

test("getRequestIp falls back to x-real-ip when x-forwarded-for is absent", () => {
  const req = new Request("http://localhost/api/x", {
    headers: { "x-real-ip": "198.51.100.9" },
  });
  assert.equal(getRequestIp(req), "198.51.100.9");
});

test("getRequestIp returns null with no forwarding headers", () => {
  const req = new Request("http://localhost/api/x");
  assert.equal(getRequestIp(req), null);
});

test("getRequestIp ignores forwarding headers when TRUST_PROXY=false", () => {
  process.env.TRUST_PROXY = "false";
  try {
    const req = new Request("http://localhost/api/x", {
      headers: { "x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.7" },
    });
    assert.equal(getRequestIp(req), null);
  } finally {
    delete process.env.TRUST_PROXY;
  }
});
