"use client";

import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

export default function BlockchainKeyBadge({ status, className = "" }) {
  if (status === "loading") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-1 text-[11px] font-semibold text-blue-500 ${className}`}
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Verifying key
      </span>
    );
  }

  if (status === "verified") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-500 ${className}`}
      >
        <ShieldCheck className="h-3 w-3" /> Key verified
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-500 ${className}`}
    >
      <ShieldAlert className="h-3 w-3" /> Key unverified
    </span>
  );
}
