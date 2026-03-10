/**
 * Stub for `next/server` used in Node's test runner.
 * Provides minimal NextResponse/NextRequest implementations.
 */

export class NextResponse extends Response {
  constructor(body, init) {
    super(body, init);
  }

  static json(data, init = {}) {
    const body = JSON.stringify(data);
    const headers = new Headers(init.headers || {});
    headers.set("content-type", "application/json");
    return new NextResponse(body, {
      ...init,
      headers,
    });
  }

  static next(init) {
    return new NextResponse(null, { status: 200, ...init });
  }

  static redirect(url, status = 307) {
    return new NextResponse(null, {
      status,
      headers: { location: typeof url === "string" ? url : url.toString() },
    });
  }
}

export { NextResponse as NextRequest };
