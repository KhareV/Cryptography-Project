"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, MessageSquare, Plus, Users } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useConversations } from "@/hooks/useConversations";
import { useGroups } from "@/hooks/useGroups";
import { Logo } from "@/components/shared/Logo";
import { UserMenu } from "@/components/shared/UserMenu";
import WalletConnectButton from "@/components/blockchain/WalletConnectButton";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBadge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { SkeletonConversationItem } from "@/components/ui/Skeleton";
import { cn, formatConversationTime, truncate } from "@/lib/utils";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const {
    setNewChatModalOpen,
    isMobileView,
    groupUnreadCounts,
    activeConversationId,
    activeGroupId,
    setActiveConversation,
    setActiveGroup,
    clearGroupUnread,
  } = useStore();
  const { conversations, isLoading: isConversationsLoading } =
    useConversations();
  const { groups, isLoading: isGroupsLoading } = useGroups();

  const showGroupsOnly = pathname?.startsWith("/groups");

  const groupUnreadTotal = Object.values(groupUnreadCounts || {}).reduce(
    (sum, count) => sum + (count || 0),
    0,
  );

  const getLastActivity = (item) => {
    const raw =
      item?.lastMessage?.timestamp ||
      item?.lastMessage?.createdAt ||
      item?.updatedAt ||
      item?.createdAt;

    if (!raw) return 0;

    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;

    const otherUser = conv.otherParticipant;
    if (!otherUser) return false;

    const searchLower = searchQuery.toLowerCase();
    return (
      otherUser.username?.toLowerCase().includes(searchLower) ||
      otherUser.firstName?.toLowerCase().includes(searchLower) ||
      otherUser.lastName?.toLowerCase().includes(searchLower)
    );
  });

  const filteredGroups = groups.filter((group) => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    return (
      group.name?.toLowerCase().includes(searchLower) ||
      group.description?.toLowerCase().includes(searchLower)
    );
  });

  const listItems = useMemo(() => {
    const groupItems = filteredGroups.map((group) => ({
      type: "group",
      id: group.id,
      sortAt: getLastActivity(group),
      payload: group,
    }));

    if (showGroupsOnly) {
      return groupItems.sort((a, b) => b.sortAt - a.sortAt);
    }

    const conversationItems = filteredConversations.map((conversation) => ({
      type: "conversation",
      id: conversation.id,
      sortAt: getLastActivity(conversation),
      payload: conversation,
    }));

    return [...groupItems, ...conversationItems].sort(
      (a, b) => b.sortAt - a.sortAt,
    );
  }, [filteredGroups, showGroupsOnly, filteredConversations]);

  const isLoading = showGroupsOnly
    ? isGroupsLoading
    : isConversationsLoading || isGroupsLoading;

  const isConversationActive = (conversationId) => {
    if (activeConversationId === conversationId) return true;
    return pathname === `/chat/${conversationId}`;
  };

  const isGroupActive = (groupId) => {
    if (activeGroupId === groupId) return true;
    return pathname === `/groups/${groupId}`;
  };

  const openConversation = (conversationId) => {
    setActiveConversation(conversationId);
    setActiveGroup(null);
    router.push(`/chat/${conversationId}`);
  };

  const openGroup = (groupId) => {
    setActiveGroup(groupId);
    setActiveConversation(null);
    clearGroupUnread(groupId);
    router.push(`/groups/${groupId}`);
  };

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      className={`
        w-full md:w-80 lg:w-[26rem] h-screen flex flex-col
        bg-background border-r border-border/70
        ${isMobileView ? "absolute inset-0 z-40" : "relative"}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/70 bg-gradient-to-b from-background to-background-secondary/40">
        <div className="rounded-2xl border border-border/70 bg-background/80 backdrop-blur px-3 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <Logo size="sm" showText={false} className="md:hidden" />
            <Logo size="sm" className="hidden md:flex" />

            <UserMenu showDetails={false} className="p-1.5" />
          </div>

          <div className="mt-3">
            <WalletConnectButton className="w-full justify-between max-w-full" />
          </div>
        </div>

        {/* Search */}
        <SearchInput
          placeholder={
            showGroupsOnly ? "Search groups..." : "Search chats and groups..."
          }
          className="mt-3 rounded-2xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
        />

        <div className="mt-3 p-1 rounded-2xl border border-border/70 bg-background-secondary/50 grid grid-cols-3 gap-1.5">
          <Link
            href="/chat"
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border transition-all ${
              pathname?.startsWith("/chat")
                ? "bg-white border-border text-foreground shadow-sm"
                : "bg-transparent border-transparent text-foreground-secondary hover:text-foreground hover:bg-background"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chats
          </Link>

          <Link
            href="/groups"
            className={`relative flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border transition-all ${
              pathname?.startsWith("/groups")
                ? "bg-white border-border text-foreground shadow-sm"
                : "bg-transparent border-transparent text-foreground-secondary hover:text-foreground hover:bg-background"
            }`}
          >
            <Users className="w-4 h-4" />
            Groups
            {groupUnreadTotal > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center shadow">
                {groupUnreadTotal > 99 ? "99+" : groupUnreadTotal}
              </span>
            )}
          </Link>

          <Link
            href="/blockchain"
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border transition-all ${
              pathname?.startsWith("/blockchain")
                ? "bg-white border-border text-foreground shadow-sm"
                : "bg-transparent border-transparent text-foreground-secondary hover:text-foreground hover:bg-background"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Chain
          </Link>
        </div>
      </div>

      {/* Unified List */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonConversationItem key={index} />
            ))}
          </div>
        ) : listItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mb-4">
              {showGroupsOnly ? (
                <Users className="w-8 h-8 text-foreground-secondary" />
              ) : (
                <MessageSquare className="w-8 h-8 text-foreground-secondary" />
              )}
            </div>
            <h3 className="font-medium text-foreground mb-2">
              {showGroupsOnly ? "No groups found" : "No chats found"}
            </h3>
            <p className="text-sm text-foreground-secondary">
              {showGroupsOnly
                ? "Try another search or create a new group"
                : "Start a new conversation or open a group"}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3">
              <AnimatePresence initial={false}>
                {listItems.map((item, index) => {
                  if (item.type === "group") {
                    const group = item.payload;
                    const unread = groupUnreadCounts?.[group.id] || 0;
                    const isActive = isGroupActive(group.id);

                    return (
                      <motion.button
                        key={`group-${group.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        onClick={() => openGroup(group.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left mb-2",
                          "hover:bg-background-secondary/70 hover:border-border",
                          isActive
                            ? "bg-primary/10 border-primary/25 shadow-sm"
                            : "bg-background border-border/70",
                        )}
                      >
                        <Avatar
                          src={group.avatar}
                          name={group.name}
                          size="lg"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <h3 className="font-semibold truncate text-foreground">
                                {group.name}
                              </h3>
                              {Number(group.joinFeeEth || 0) > 0 && (
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    group.onChainRegistered
                                      ? "bg-emerald-500/15 text-emerald-500"
                                      : "bg-amber-500/15 text-amber-500"
                                  }`}
                                >
                                  {group.onChainRegistered
                                    ? `${Number(group.joinFeeEth).toFixed(3)} ETH`
                                    : "Pending"}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-foreground-secondary flex-shrink-0 ml-2">
                              {group.lastMessage?.timestamp &&
                                formatConversationTime(
                                  group.lastMessage.timestamp,
                                )}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <p className="text-sm truncate text-foreground-secondary">
                              {group.lastMessage?.content
                                ? truncate(group.lastMessage.content, 40)
                                : `${group.memberCount || group.members?.length || 0} members`}
                            </p>

                            {unread > 0 && (
                              <NotificationBadge
                                count={unread}
                                className="relative top-0 right-0 ml-2 shadow-sm"
                              />
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  }

                  const conversation = item.payload;
                  const otherUser = conversation.otherParticipant;
                  const lastMessage = conversation.lastMessage;
                  const isActive = isConversationActive(conversation.id);

                  const displayName = otherUser
                    ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() ||
                      otherUser.username
                    : "Unknown User";

                  const preview = lastMessage?.content
                    ? truncate(lastMessage.content, 40)
                    : "No messages yet";

                  return (
                    <motion.button
                      key={`conversation-${conversation.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      onClick={() => openConversation(conversation.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left mb-2",
                        "hover:bg-background-secondary/70 hover:border-border",
                        isActive
                          ? "bg-primary/10 border-primary/25 shadow-sm"
                          : "bg-background border-border/70",
                      )}
                    >
                      <Avatar
                        src={otherUser?.avatar}
                        name={displayName}
                        size="lg"
                        showStatus
                        isOnline={otherUser?.isOnline}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-semibold truncate text-foreground">
                              {displayName}
                            </h3>
                            <span className="shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-500">
                              1:1
                            </span>
                          </div>
                          <span className="text-xs text-foreground-secondary flex-shrink-0 ml-2">
                            {lastMessage?.timestamp &&
                              formatConversationTime(lastMessage.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p
                            className={cn(
                              "text-sm truncate",
                              conversation.unreadCount > 0
                                ? "text-foreground font-medium"
                                : "text-foreground-secondary",
                            )}
                          >
                            {preview}
                          </p>

                          {conversation.unreadCount > 0 && (
                            <NotificationBadge
                              count={conversation.unreadCount}
                              className="relative top-0 right-0 ml-2"
                            />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* New Chat Button */}
      <div className="p-4 border-t border-border/70 bg-gradient-to-t from-background to-background-secondary/40">
        <Button
          variant="primary"
          size="lg"
          className="w-full rounded-2xl h-12"
          onClick={() => setNewChatModalOpen(true)}
          leftIcon={<Plus className="w-5 h-5" />}
        >
          New Conversation
        </Button>
      </div>
    </motion.aside>
  );
}
