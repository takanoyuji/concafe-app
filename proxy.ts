import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // 認証済みユーザーを認証ページからリダイレクト
  if (
    (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup")) &&
    session
  ) {
    return NextResponse.redirect(new URL("/me", request.url));
  }

  // 要ログイン
  const protectedPaths = ["/me", "/gift"];
  if (protectedPaths.some((p) => pathname.startsWith(p)) && !session) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // 要ADMIN
  if (pathname.startsWith("/admin") && (!session || session.role !== "ADMIN")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // mustChangePassword 強制リダイレクト（パスワード変更ページとAPIは除外）
  if (
    session?.mustChangePassword &&
    !pathname.startsWith("/auth/reset-password") &&
    !pathname.startsWith("/api/auth/reset-password") &&
    !pathname.startsWith("/api/auth/logout")
  ) {
    return NextResponse.redirect(new URL("/auth/reset-password", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/me/:path*",
    "/gift/:path*",
    "/admin/:path*",
    "/auth/login",
    "/auth/signup",
  ],
};
