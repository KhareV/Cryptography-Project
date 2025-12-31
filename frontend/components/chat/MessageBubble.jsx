"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCheck,
  MoreHorizontal,
  Reply,
  Copy,
  Trash,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import { formatMessageTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const [showActions, setShowActions] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success("Message copied");
  };

  const statusIcon = () => {
    if (!isOwn) return null;

    switch (message.status) {
      case "sent":
        return <Check className="w-3. 5 h-3.5 text-foreground-secondary" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-foreground-secondary" />;
      case "read":
        return <CheckCheck className="w-3.5 h-3.5 text-accent" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex gap-2 mb-1 group",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className={cn("w-8 flex-shrink-0", !showAvatar && "invisible")}>
        {!isOwn && showAvatar && (
          <Avatar
            src={message.sender?.avatar}
            name={message.sender?.username}
            size="sm"
          />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "max-w-[70%] flex flex-col",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {/* Sender Name (for group chats) */}
        {!isOwn && showAvatar && (
          <span className="text-xs font-medium text-foreground-secondary mb-1 ml-1">
            {message.sender?.firstName || message.sender?.username}
          </span>
        )}

        <div
          className={cn(
            "flex items-end gap-1",
            isOwn ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* Bubble */}
          <div
            className={cn(
              "relative px-4 py-2 rounded-2xl break-words",
              isOwn
                ? "bg-accent text-white rounded-br-md"
                : "bg-background-tertiary text-foreground rounded-bl-md",
              message.isOptimistic && "opacity-70"
            )}
          >
            {/* Reply Preview */}
            {message.replyTo && (
              <div
                className={cn(
                  "mb-2 p-2 rounded-lg text-xs border-l-2",
                  isOwn
                    ? "bg-white/10 border-white/50"
                    : "bg-background-secondary border-accent"
                )}
              >
                <span className="font-medium">
                  {message.replyTo.sender?.username}
                </span>
                <p className="truncate opacity-80">{message.replyTo.content}</p>
              </div>
            )}

            {/* Content */}
            {message.type === "image" && message.fileUrl ? (
              <div className="space-y-2">
                <img
                  src={message.fileUrl}
                  alt="Image"
                  className="max-w-[300px] max-h-[400px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(message.fileUrl, '_blank')}
                />
                {message.content && (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}

            {/* Time & Status */}
            <div
              className={cn(
                "flex items-center gap-1 mt-1",
                isOwn ? "justify-end" : "justify-start"
              )}
            >
              <span
                className={cn(
                  "text-[10px]",
                  isOwn ? "text-white/70" : "text-foreground-secondary"
                )}
              >
                {formatMessageTime(message.createdAt)}
              </span>
              {message.isEdited && (
                <span
                  className={cn(
                    "text-[10px]",
                    isOwn ? "text-white/70" : "text-foreground-secondary"
                  )}
                >
                  (edited)
                </span>
              )}
              {statusIcon()}
            </div>
          </div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showActions ? 1 : 0 }}
            className="flex-shrink-0"
          >
            <Dropdown
              trigger={
                <button className="p-1 rounded-full hover:bg-background-secondary text-foreground-secondary">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              }
              align={isOwn ? "right" : "left"}
            >
              <DropdownItem icon={<Reply className="w-4 h-4" />}>
                Reply
              </DropdownItem>
              <DropdownItem
                icon={<Copy className="w-4 h-4" />}
                onClick={handleCopy}
              >
                Copy
              </DropdownItem>
              {isOwn && (
                <>
                  <DropdownSeparator />
                  <DropdownItem
                    icon={<Trash className="w-4 h-4" />}
                    isDestructive
                  >
                    Delete
                  </DropdownItem>
                </>
              )}
            </Dropdown>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
