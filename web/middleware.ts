import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Protects the dashboard and enforces the platform-admin section:
 *  - /dashboard/**        any signed-in user
 *  - /dashboard/admin/**  platform admins only
 */
export default withAuth(
  function middleware(req) {
    const userType = (req.nextauth.token as any)?.user?.type;
    const { pathname } = req.nextUrl;

    if (pathname.startsWith("/dashboard/admin") && userType !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/signin",
    },
  },
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
