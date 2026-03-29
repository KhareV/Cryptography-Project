"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { useStore } from "@/store/useStore";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useCall } from "@/context/CallContext";
import { joinConversation, leaveConversation } from "@/lib/socket";
import { keyAPI, setAuthToken } from "@/lib/api";
import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import RightPanel from "@/components/chat/RightPanel";
import NewChatModal from "@/components/chat/NewChatModal";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId;
  const { getToken } = useAuth();

  const {
    isMobileView,
    isRightPanelOpen,
    isNewChatModalOpen,
    setNewChatModalOpen,
    setActiveConversation,
    isSocketConnected,
  } = useStore();

  const { activeConversation, markAsRead } = useConversations();
  const { initiateCall } = useCall();
  const [keyStatus, setKeyStatus] = useState({
    loading: false,
    verified: false,
    message: "",
  });
  const {
    messages,
    isLoading,
    isSending,
    hasMore,
    fetchMessages,
    loadMore,
    sendMessage,
    handleTyping,
  } = useMessages(conversationId);

  // Set active conversation
  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
      fetchMessages();
      markAsRead(conversationId);
    }
  }, [conversationId, setActiveConversation, fetchMessages, markAsRead]);

  // Join/leave conversation room when socket connects
  useEffect(() => {
    if (conversationId && isSocketConnected) {
      // Join conversation room
      joinConversation(conversationId).catch((err) => {
        console.error("Failed to join conversation:", err);
      });

      return () => {
        leaveConversation(conversationId).catch((err) => {
          console.error("Failed to leave conversation:", err);
        });
      };
    }
  }, [conversationId, isSocketConnected]);

  useEffect(() => {
    if (activeConversation?.type && activeConversation.type !== "direct") {
      setKeyStatus({ loading: false, verified: true, message: "" });
      return;
    }

    const targetUserId =
      activeConversation?.otherParticipant?.id ||
      activeConversation?.otherParticipant?._id;

    if (!targetUserId) {
      setKeyStatus({ loading: false, verified: false, message: "" });
      return;
    }

    const normalizedTargetUserId = targetUserId.toString();
    const isMongoObjectId = /^[a-fA-F0-9]{24}$/.test(normalizedTargetUserId);

    if (!isMongoObjectId) {
      setKeyStatus({
        loading: false,
        verified: false,
        message: "Recipient key status is unavailable for this chat.",
      });
      return;
    }

    let cancelled = false;

    const fetchKeyStatus = async () => {
      try {
        setKeyStatus((prev) => ({ ...prev, loading: true }));
        const token = await getToken();
        setAuthToken(token);

        const response = await keyAPI.getStatus(normalizedTargetUserId);
        const status = response.data?.status;

        if (!cancelled) {
          setKeyStatus({
            loading: false,
            verified: Boolean(status?.verified),
            message: status?.verified
              ? ""
              : "Recipient key is not verified on-chain.",
          });
        }
      } catch {
        if (!cancelled) {
          setKeyStatus({
            loading: false,
            verified: false,
            message: "Could not verify recipient key on-chain.",
          });
        }
      }
    };

    fetchKeyStatus();

    return () => {
      cancelled = true;
    };
  }, [
    activeConversation?.id,
    activeConversation?.otherParticipant?.id,
    activeConversation?.otherParticipant?._id,
    getToken,
  ]);

  // Handle call initiation
  const handleCallUser = () => {
    if (activeConversation?.otherParticipant) {
      const peer = activeConversation.otherParticipant;
      const peerId = peer.id || peer._id;
      const peerName =
        `${peer.firstName || ""} ${peer.lastName || ""}`.trim() ||
        peer.username ||
        "Unknown";

      initiateCall(peerId, peerName, peer.avatar || "");
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - Hidden on mobile when viewing conversation */}
      {(!isMobileView || !conversationId) && <Sidebar />}

      {/* Main Chat Area */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col bg-background/85 min-w-0 border-l border-border/50"
      >
        {/* Chat Header */}
        <ChatHeader
          conversation={activeConversation}
          onBack={() => router.push("/chat")}
          showBackButton={isMobileView}
          onCallUser={handleCallUser}
          blockchainKeyStatus={
            keyStatus.loading
              ? "loading"
              : keyStatus.verified
                ? "verified"
                : "unverified"
          }
        />

        {/* Messages */}
        <MessageList
          messages={messages}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          conversationId={conversationId}
        />

        {/* Message Input */}
        <MessageInput
          onSend={sendMessage}
          onTyping={handleTyping}
          isSending={isSending}
          disabled={!activeConversation}
          verificationWarning={
            Boolean(activeConversation) &&
            !keyStatus.loading &&
            !keyStatus.verified
          }
          warningText={
            keyStatus.message || "Recipient key is not verified on-chain."
          }
        />
      </motion.main>

      {/* Right Panel */}
      {isRightPanelOpen && !isMobileView && (
        <RightPanel conversation={activeConversation} />
      )}

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
      />
    </div>
  );
}
