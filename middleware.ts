import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // 1. Maintenance mode check
  if (process.env.MAINTENANCE_MODE === "true") {
    // Skip if already on maintenance page, static assets, or API routes
    if (
      !request.nextUrl.pathname.startsWith("/maintenance") &&
      !request.nextUrl.pathname.startsWith("/api")
    ) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
