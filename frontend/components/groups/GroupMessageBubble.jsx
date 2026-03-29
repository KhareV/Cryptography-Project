"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { formatMessageTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function GroupMessageBubble({ message, isOwn }) {
  const senderName =
    `${message.sender?.firstName || ""} ${message.sender?.lastName || ""}`.trim() ||
    message.sender?.username ||
    "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2 mb-3", isOwn ? "justify-end" : "justify-start")}
    >
      {!isOwn && (
        <Avatar
          src={message.sender?.avatar}
          name={senderName}
          size="sm"
          className="mt-1"
        />
      )}

      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2.5 border shadow-sm",
          isOwn
            ? "bg-gradient-to-br from-accent to-blue-600 text-white border-transparent"
            : "bg-background text-foreground border-border/80",
        )}
      >
        {!isOwn && (
          <p className="text-xs font-semibold mb-1 opacity-80">{senderName}</p>
        )}

        {message.type === "image" && message.fileUrl ? (
          <img
            src={message.fileUrl}
            alt="Group attachment"
            className="rounded-xl max-h-56 w-auto mb-1"
          />
        ) : null}

        {message.fileUrl && message.type === "file" ? (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "underline break-all",
              isOwn ? "text-white" : "text-accent",
            )}
          >
            {message.content || "Open file"}
          </a>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        <p
          className={cn(
            "text-[11px] mt-1 text-right",
            isOwn ? "text-white/80" : "text-foreground-secondary",
          )}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </motion.div>
  );
}
