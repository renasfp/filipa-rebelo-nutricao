import { NextResponse, type NextRequest } from "next/server";
import { hasSiteAccess, SITE_ACCESS_COOKIE } from "@/lib/site-access";

export function proxy(request: NextRequest) {
  if (hasSiteAccess(request.cookies.get(SITE_ACCESS_COOKIE)?.value)) return NextResponse.next();

  const url = new URL("/em-construcao", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!em-construcao|_next/static|_next/image|images/|favicon.ico).*)"],
};
