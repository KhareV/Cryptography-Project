import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: ["/", "/sign-in", "/sign-up", "/api/webhook(.*)"],
  // Routes that can be accessed while signed out
  ignoredRoutes: ["/api/health"],
});

export const config = {
  matcher: ["/((?!. +\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
