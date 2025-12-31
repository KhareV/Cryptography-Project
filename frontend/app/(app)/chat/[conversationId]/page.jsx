"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useConversations } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { useCalling } from "@/hooks/useCalling";
import { joinConversation, leaveConversation } from "@/lib/socket";
import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import RightPanel from "@/components/chat/RightPanel";
import NewChatModal from "@/components/chat/NewChatModal";
import CallModal from "@/components/chat/CallModal";
import IncomingCallModal from "@/components/chat/IncomingCallModal";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId;

  const {
    isMobileView,
    isSidebarOpen,
    isRightPanelOpen,
    isNewChatModalOpen,
    setNewChatModalOpen,
    setActiveConversation,
    isSocketConnected,
    user,
  } = useStore();

  const { activeConversation, markAsRead } = useConversations();
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

  // Call functionality
  const {
    activeCall,
    incomingCall,
    isCallModalOpen,
    callStatus,
    isMuted,
    isLoading: isCallLoading,
    localAudioRef,
    remoteAudioRef,
    startCall,
    handleAnswerCall,
    handleDeclineCall,
    handleCallEnd,
    toggleMute,
  } = useCalling();

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

  // Handle call initiation
  const handleCallUser = () => {
    if (activeConversation?.otherParticipant) {
      startCall(conversationId, activeConversation.otherParticipant);
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
        className="flex-1 flex flex-col bg-background min-w-0"
      >
        {/* Chat Header */}
        <ChatHeader
          conversation={activeConversation}
          onBack={() => router.push("/chat")}
          showBackButton={isMobileView}
          onCallUser={handleCallUser}
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

      {/* Call Modals */}
      <CallModal
        isOpen={isCallModalOpen}
        activeCall={activeCall}
        callStatus={callStatus}
        isMuted={isMuted}
        isLoading={isCallLoading}
        onEndCall={handleCallEnd}
        onToggleMute={toggleMute}
        localAudioRef={localAudioRef}
        remoteAudioRef={remoteAudioRef}
        currentUser={user}
      />

      <IncomingCallModal
        incomingCall={incomingCall}
        onAnswer={handleAnswerCall}
        onDecline={handleDeclineCall}
        isLoading={isCallLoading}
      />
    </div>
  );
}
