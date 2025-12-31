"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Phone, Info, MoreVertical } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/Dropdown";
import { formatRelativeTime } from "@/lib/utils";
import TypingIndicator from "./TypingIndicator";

export default function ChatHeader({
  conversation,
  onBack,
  showBackButton,
  onCallUser,
}) {
  const { toggleRightPanel, getTypingUsers } = useStore();

  const otherUser = conversation?.otherParticipant;
  const typingUsers = getTypingUsers(conversation?.id);

  const displayName = otherUser
    ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() ||
      otherUser.username
    : "Select a conversation";

  const statusText =
    typingUsers.length > 0
      ? null
      : otherUser?.isOnline
      ? "Online"
      : otherUser?.lastSeen
      ? `Last seen ${formatRelativeTime(otherUser.lastSeen)}`
      : "Offline";

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
      {/* Back Button (Mobile) */}
      {showBackButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      )}

      {/* User Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar
          src={otherUser?.avatar}
          name={displayName}
          size="md"
          showStatus
          isOnline={otherUser?.isOnline}
        />

        <div className="min-w-0">
          <h2 className="font-semibold text-foreground truncate">
            {displayName}
          </h2>
          {typingUsers.length > 0 ? (
            <TypingIndicator users={typingUsers} />
          ) : (
            <p className="text-sm text-foreground-secondary truncate">
              {statusText}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex"
          onClick={() => onCallUser && onCallUser()}
          disabled={!otherUser?.isOnline}
          title={otherUser?.isOnline ? "Start voice call" : "User is offline"}
        >
          <Phone className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleRightPanel}>
          <Info className="w-5 h-5" />
        </Button>

        <Dropdown
          trigger={
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5" />
            </Button>
          }
          align="right"
        >
          <DropdownItem>Search in conversation</DropdownItem>
          <DropdownItem>Mute notifications</DropdownItem>
          <DropdownSeparator />
          <DropdownItem isDestructive>Delete conversation</DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
