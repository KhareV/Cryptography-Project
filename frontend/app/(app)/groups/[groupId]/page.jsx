"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import toast from "react-hot-toast";
import { useStore } from "@/store/useStore";
import { useGroups } from "@/hooks/useGroups";
import { useGroupMessages } from "@/hooks/useGroupMessages";
import GroupChatPage from "@/components/groups/GroupChatPage";
import GroupInfoPanel from "@/components/groups/GroupInfoPanel";
import AddMembersModal from "@/components/groups/AddMembersModal";
import Sidebar from "@/components/chat/Sidebar";

export default function GroupConversationPage() {
  const params = useParams();
  const router = useRouter();
  const { userId } = useAuth();
  const groupId = params.groupId;

  const { isMobileView, setMobileView, setActiveGroup, clearGroupUnread } =
    useStore();

  const {
    groups,
    getGroup,
    addMember,
    removeMember,
    updateGroupDetails,
    registerGroupOnChain,
    leaveGroup,
    deleteGroup,
  } = useGroups();

  const {
    messages,
    isLoading: isMessagesLoading,
    isSending,
    hasMore,
    loadMore,
    sendMessage,
    handleTyping,
  } = useGroupMessages(groupId);

  const [showInfo, setShowInfo] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const group = useMemo(
    () => groups.find((item) => item.id === groupId) || null,
    [groups, groupId],
  );

  useEffect(() => {
    const handleResize = () => {
      setMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setMobileView]);

  useEffect(() => {
    if (!groupId) return;
    setActiveGroup(groupId);
    clearGroupUnread(groupId);
    getGroup(groupId).catch((error) => {
      toast.error(error.message || "Failed to load group");
      router.push("/groups");
    });

    return () => {
      setActiveGroup(null);
    };
  }, [groupId, setActiveGroup, clearGroupUnread, getGroup, router]);

  const handleAddMembers = useCallback(
    async (memberIds) => {
      for (const memberId of memberIds) {
        await addMember(groupId, memberId);
      }
    },
    [addMember, groupId],
  );

  const handleRemoveMember = useCallback(
    async (memberId) => {
      await removeMember(groupId, memberId);
    },
    [removeMember, groupId],
  );

  const handleLeave = useCallback(async () => {
    await leaveGroup(groupId);
    router.push("/groups");
  }, [leaveGroup, groupId, router]);

  const handleDelete = useCallback(async () => {
    await deleteGroup(groupId);
    router.push("/groups");
  }, [deleteGroup, groupId, router]);

  const handleRegisterOnChain = useCallback(
    async (targetGroupId, payload) => {
      await registerGroupOnChain(targetGroupId, payload);
      await getGroup(targetGroupId);
    },
    [registerGroupOnChain, getGroup],
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {!isMobileView && <Sidebar />}

      <div className="flex-1 min-w-0 flex flex-col border-l border-border/50 bg-background/85">
        <GroupChatPage
          group={group}
          messages={messages}
          isLoading={isMessagesLoading}
          isSending={isSending}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onSend={sendMessage}
          onTyping={handleTyping}
          onBack={() => router.push("/groups")}
          showBackButton={isMobileView}
          onOpenInfo={() => setShowInfo((value) => !value)}
        />
      </div>

      {showInfo && !isMobileView && (
        <GroupInfoPanel
          group={group}
          currentUserId={userId}
          onOpenAddMembers={() => setShowAddMembers(true)}
          onRemoveMember={handleRemoveMember}
          onLeaveGroup={handleLeave}
          onDeleteGroup={handleDelete}
          onUpdateGroup={(payload) => updateGroupDetails(groupId, payload)}
          onRegisterOnChain={handleRegisterOnChain}
        />
      )}

      {showInfo && isMobileView && (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="absolute inset-y-0 right-0 w-[92vw] max-w-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <GroupInfoPanel
              group={group}
              currentUserId={userId}
              onOpenAddMembers={() => setShowAddMembers(true)}
              onRemoveMember={handleRemoveMember}
              onLeaveGroup={handleLeave}
              onDeleteGroup={handleDelete}
              onUpdateGroup={(payload) => updateGroupDetails(groupId, payload)}
              onRegisterOnChain={handleRegisterOnChain}
            />
          </div>
        </div>
      )}

      <AddMembersModal
        isOpen={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        existingMembers={group?.members || []}
        onAddMembers={handleAddMembers}
      />
    </div>
  );
}
