"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";
import { WalletProvider } from "@/context/WalletContext";
import { CallProvider } from "@/context/CallContext";
import NetworkWarningBanner from "@/components/blockchain/NetworkWarningBanner";
import IncomingCallAlert from "@/components/call/IncomingCallAlert";
import ActiveCallBar from "@/components/call/ActiveCallBar";
import CallScreen from "@/components/call/CallScreen";

export function Providers({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <ClerkProvider>
        <WalletProvider>
          <CallProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange={false}
            >
              <div style={{ visibility: "hidden" }}>{children}</div>
            </ThemeProvider>
          </CallProvider>
        </WalletProvider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0084FF",
          colorBackground: "var(--bg-primary)",
          colorText: "var(--text-primary)",
          colorInputBackground: "var(--bg-secondary)",
          colorInputText: "var(--text-primary)",
          borderRadius: "0.75rem",
        },
        elements: {
          formButtonPrimary:
            "bg-accent hover:bg-accent-hover transition-colors",
          card: "shadow-large",
          headerTitle: "text-2xl font-bold",
          headerSubtitle: "text-foreground-secondary",
          socialButtonsBlockButton:
            "border-border hover:bg-background-secondary transition-colors",
          formFieldInput: "border-border focus:border-accent focus:ring-accent",
          footerActionLink: "text-accent hover:text-accent-hover",
        },
      }}
    >
      <WalletProvider>
        <CallProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
          >
            <NetworkWarningBanner />
            {children}
            <IncomingCallAlert />
            <ActiveCallBar />
            <CallScreen />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "12px",
                  padding: "16px",
                  boxShadow: "0 4px 25px -5px rgba(0, 0, 0, 0.1)",
                },
                success: {
                  iconTheme: {
                    primary: "#10B981",
                    secondary: "#FFFFFF",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "#EF4444",
                    secondary: "#FFFFFF",
                  },
                },
              }}
            />
          </ThemeProvider>
        </CallProvider>
      </WalletProvider>
    </ClerkProvider>
  );
}
