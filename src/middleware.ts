import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/cadastro", "/api/cron", "/api/logout"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("sessao")?.value;

  let authenticated = false;
  if (token) {
    try {
      await jwtVerify(
        token,
        new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret")
      );
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated && !isPublic(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authenticated && (pathname === "/login" || pathname === "/cadastro")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)).*)"],
};
