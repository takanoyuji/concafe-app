import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

// lib/permissions.ts は prisma を持つのでエッジでは読まない。ロールの判定だけここに写す
const isAdminRole = (role: string | undefined) => role === "OWNER" || role === "MANAGER" || role === "ADMIN";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // 認証済みユーザーを認証ページからリダイレクト
  if (
    (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup")) &&
    session
  ) {
    return NextResponse.redirect(new URL(session.role === "CAST" ? "/cast/me" : isAdminRole(session.role) ? "/admin" : "/me", request.url));
  }

  // 要ログイン
  const protectedPaths = ["/me", "/gift"];
  if (protectedPaths.some((p) => pathname.startsWith(p)) && !session) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // キャストポータルは CAST だけ。CUSTOMER / ADMIN は入れない（代理閲覧は作らない。要件書 2章）
  if (pathname.startsWith("/cast/me")) {
    if (!session) return NextResponse.redirect(new URL("/auth/login", request.url));
    if (session.role !== "CAST") return NextResponse.redirect(new URL("/", request.url));
  }

  // 管理画面は OWNER / MANAGER（旧 ADMIN）。機能ごとの可否は各ページ・APIで判定する
  if (pathname.startsWith("/admin") && (!session || !isAdminRole(session.role))) {
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
    "/cast/me/:path*",
    "/admin/:path*",
    "/auth/login",
    "/auth/signup",
  ],
};
