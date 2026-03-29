"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@clerk/nextjs";
import { anchorAPI, setAuthToken } from "@/lib/api";
import AnchorInfoPopover from "@/components/blockchain/AnchorInfoPopover";

export default function AnchorBadge({ type, id, title = "" }) {
  const { getToken } = useAuth();
  const badgeRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAnchor = async () => {
      if (!id || !type) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const token = await getToken();
        setAuthToken(token);

        const response =
          type === "conversation"
            ? await anchorAPI.getConversationAnchor(id)
            : await anchorAPI.getGroupAnchor(id);

        if (cancelled) return;

        setAnchor(response.data?.lastAnchor || null);
        setHasError(false);
      } catch {
        if (cancelled) return;
        setHasError(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAnchor();

    return () => {
      cancelled = true;
    };
  }, [getToken, id, type]);

  if (hasError) {
    return null;
  }

  if (isLoading) {
    return (
      <span className="inline-flex h-6 w-28 animate-pulse rounded-full bg-background-secondary" />
    );
  }

  const anchoredAt = anchor?.anchoredAt ? new Date(anchor.anchoredAt) : null;
  const anchoredLabel = anchoredAt
    ? `Anchored ${formatDistanceToNow(anchoredAt, { addSuffix: true })}`
    : "Not anchored";

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
          anchor?.merkleRoot
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
            : "border-border/80 bg-background-secondary text-foreground-secondary"
        }`}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span>{anchor?.merkleRoot ? "Anchor" : "Anchor"}</span>
        <span>{anchoredLabel}</span>
      </button>

      <AnchorInfoPopover
        type={type}
        id={id}
        title={title}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={badgeRef}
        anchorData={anchor}
        onAnchorUpdated={(nextAnchor) => setAnchor(nextAnchor)}
      />
    </>
  );
}
