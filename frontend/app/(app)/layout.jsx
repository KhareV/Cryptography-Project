"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useSocket } from "@/hooks/useSocket";
import { authAPI, setAuthToken } from "@/lib/api";

export default function AppLayout({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const { setUser, user } = useStore();

  // Initialize socket connection
  useSocket();

  // Sync user with backend
  useEffect(() => {
    const syncUser = async () => {
      if (!isSignedIn || !clerkUser) return;

      try {
        const token = await getToken();
        setAuthToken(token);

        const response = await authAPI.syncUser();
        setUser(response.data?.user);
      } catch (error) {
        console.error("Failed to sync user:", error);
      }
    };

    syncUser();
  }, [isSignedIn, clerkUser, getToken, setUser]);

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  // Loading state
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-foreground-secondary">Loading... </p>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-background"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
