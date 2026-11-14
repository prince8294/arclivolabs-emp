import { NextResponse, type NextRequest } from "next/server";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(request: NextRequest) {
  if (safeMethods.has(request.method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.origin !== "null" && originUrl.origin === request.nextUrl.origin) {
        return NextResponse.next();
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  } else if (request.headers.get("sec-fetch-site") === "same-origin") {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
}

export const config = {
  matcher: ["/api/:path*"],
};
