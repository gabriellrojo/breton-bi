
import { NextRequest, NextResponse } from "next/server";

import {
  isAuthenticated,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./lib/auth";

export async function middleware(
  request: NextRequest
) {
  const { pathname } = request.nextUrl;

  const authenticated = await isAuthenticated(request);

  const isLoginPage = pathname === "/login";

  const isLoginApi =
    pathname === "/api/auth/login";

  const isLogoutApi =
    pathname === "/api/auth/logout";

  if (isLoginApi) {
    return NextResponse.next();
  }

  if (isLoginPage) {
    if (authenticated) {
      return NextResponse.redirect(
        new URL("/", request.url)
      );
    }

    return NextResponse.next();
  }

  if (isLogoutApi) {
    return NextResponse.next();
  }

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 }
      );
    }

    const response = NextResponse.redirect(
      new URL("/login", request.url)
    );

    response.cookies.delete(SESSION_COOKIE);

    return response;
  }

  const response = NextResponse.next();

  // Mantém a sessão existente, sem renovar o
  // prazo de expiração a cada requisição.
  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
