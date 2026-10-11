import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/pricing", "/icon", "/docs(.*)", "/llms.txt", "/api/docs/execute", "/api/webhook"]);
const isAppPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/icon", "/api/webhook"]);

function isAppHost(request: NextRequest) {
  return request.nextUrl.hostname === "app.screenshotapi.tech";
}

const authenticate = clerkMiddleware(async (auth, request) => {
  const publicRoute = isAppHost(request) ? isAppPublicRoute(request) : isPublicRoute(request);
  if (!publicRoute) await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if ((!isAppHost(request) && request.nextUrl.pathname === "/pricing") || request.nextUrl.pathname === "/api/webhook" || request.nextUrl.pathname === "/api/webhooks/clerk") {
    return NextResponse.next();
  }
  return authenticate(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
