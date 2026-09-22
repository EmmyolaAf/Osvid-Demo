import { createClient, OAuthStrategy, Tokens } from "@wix/sdk";
import { env } from "@/env";
import { NextRequest, NextResponse } from "next/server";
import { WIX_SESSION_COOKIE } from "./lib/constants";

const wixClient = createClient({
  auth: OAuthStrategy({ clientId: env.NEXT_PUBLIC_WIX_CLIENT_ID }),
});

export async function middleware(request: NextRequest) {
  // 1. First check maintenance mode
  if (process.env.MAINTENANCE_MODE === "true") {
    // Skip if already on maintenance page or API routes
    if (
      !request.nextUrl.pathname.startsWith("/maintenance") &&
      !request.nextUrl.pathname.startsWith("/api")
    ) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
  }

  // 2. Proceed with existing auth logic for non-maintenance requests
  const sessionCookie = request.cookies.get(WIX_SESSION_COOKIE);
  let sessionTokens: Tokens | undefined;

  if (sessionCookie) {
    try {
      sessionTokens = JSON.parse(sessionCookie.value) as Tokens;
    } catch {
      sessionTokens = undefined;
    }
  }

  if (!sessionTokens) {
    try {
      sessionTokens = await wixClient.auth.generateVisitorTokens();
    } catch (e) {
      // In local preview without live Wix keys, continue gracefully
    }
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (sessionTokens && sessionTokens.accessToken && sessionTokens.accessToken.expiresAt < nowInSeconds) {
    try {
      sessionTokens = await wixClient.auth.renewToken(
        sessionTokens.refreshToken
      );
    } catch (error) {
      try {
        sessionTokens = await wixClient.auth.generateVisitorTokens();
      } catch {
        // Ignored in preview
      }
    }
  }

  const response = NextResponse.next();

  if (sessionTokens) {
    response.cookies.set(WIX_SESSION_COOKIE, JSON.stringify(sessionTokens), {
      maxAge: 60 * 60 * 24 * 14, // 14 days
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
