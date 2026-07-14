import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

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
