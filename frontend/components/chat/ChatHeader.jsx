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
import BlockchainKeyBadge from "@/components/blockchain/BlockchainKeyBadge";
import AnchorBadge from "@/components/blockchain/AnchorBadge";

export default function ChatHeader({
  conversation,
  onBack,
  showBackButton,
  onCallUser,
  blockchainKeyStatus = "unverified",
}) {
  const { toggleRightPanel, getTypingUsers, isUserInCall } = useStore();

  const otherUser = conversation?.otherParticipant;
  const otherUserId = otherUser?.id || otherUser?._id;
  const otherUserBusy = otherUserId
    ? isUserInCall(otherUserId.toString())
    : false;
  const typingUsers = getTypingUsers(conversation?.id);

  const displayName = otherUser
    ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() ||
      otherUser.username
    : "Select a conversation";

  const statusText =
    typingUsers.length > 0
      ? null
      : otherUserBusy
        ? "In a call"
        : otherUser?.isOnline
          ? "Online"
          : otherUser?.lastSeen
            ? `Last seen ${formatRelativeTime(otherUser.lastSeen)}`
            : "Offline";

  const callButtonDisabled = !otherUser?.isOnline || otherUserBusy;
  const callButtonTitle = !otherUser?.isOnline
    ? "User is offline"
    : otherUserBusy
      ? "In a call"
      : "Start audio call";

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-border/70 bg-background/90 backdrop-blur">
      {/* Back Button (Mobile) */}
      {showBackButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="md:hidden rounded-xl"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      )}

      {/* User Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0 rounded-2xl px-2 py-1">
        <Avatar
          src={otherUser?.avatar}
          name={displayName}
          size="md"
          showStatus
          isOnline={otherUser?.isOnline}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              {displayName}
            </h2>
            <BlockchainKeyBadge
              status={blockchainKeyStatus}
              className="hidden sm:inline-flex"
            />
            {conversation?.id && (
              <AnchorBadge
                type="conversation"
                id={conversation.id}
                title={displayName}
              />
            )}
          </div>
          {typingUsers.length > 0 ? (
            <TypingIndicator users={typingUsers} />
          ) : (
            <p className="text-xs text-foreground-secondary truncate">
              {statusText}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="icon"
          className="hidden sm:flex h-9 w-9"
          onClick={() => onCallUser && onCallUser()}
          disabled={callButtonDisabled}
          title={callButtonTitle}
        >
          <Phone className="w-5 h-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-9 w-9"
          onClick={toggleRightPanel}
        >
          <Info className="w-5 h-5" />
        </Button>

        <Dropdown
          trigger={
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
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
