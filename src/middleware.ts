import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // /admin/login은 보호하지 않음
  if (pathname === "/admin/login") return NextResponse.next();

  // /admin/* 접근 시 인증 확인
  if (pathname.startsWith("/admin")) {
    if (!req.auth) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
})

export const config = {
  matcher: ["/admin/:path*"],
}
