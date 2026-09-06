import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const AUTH_PAGES = ["/login", "/signup"];

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const hasSessionCookie = Boolean(getSessionCookie(request));

	// Cookie-existence check only — this is NOT a security boundary.
	// Every protected page/action must verify the session server-side.
	if (!hasSessionCookie && pathname.startsWith("/dashboard")) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	if (hasSessionCookie && AUTH_PAGES.includes(pathname)) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
	],
};
