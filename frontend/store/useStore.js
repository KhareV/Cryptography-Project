import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // ============================================
      // User State
      // ============================================
      user: null,
      setUser: (user) => set({ user }),
      updateUser: (updates) => set((state) => ({ 
        user: state.user ? { ...state.user, ...updates } : null 
      })),
      clearUser: () => set({ user: null }),

      // ============================================
      // Conversations State
      // ============================================
      conversations: [],
      activeConversationId: null,
      
      setConversations: (conversations) => set({ conversations }),
      
      addConversation: (conversation) => set((state) => ({
        conversations: [conversation, ...state.conversations.filter(c => c.id !== conversation.id)]
      })),
      
      updateConversation: (conversationId, updates) => set((state) => ({
        conversations: state.conversations.map((conv) =>
          conv.id === conversationId ? { ...conv, ...updates } :  conv
        )
      })),
      
      removeConversation: (conversationId) => set((state) => ({
        conversations:  state.conversations.filter((conv) => conv.id !== conversationId),
        activeConversationId: state.activeConversationId === conversationId 
          ? null 
          : state.activeConversationId
      })),
      
      setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),
      
      getActiveConversation: () => {
        const state = get();
        return state.conversations.find((c) => c.id === state.activeConversationId);
      },

      // ============================================
      // Messages State
      // ============================================
      messages: {}, // { conversationId: Message[] }
      
      setMessages: (conversationId, messages) => set((state) => ({
        messages: { ...state.messages, [conversationId]: messages }
      })),
      
      addMessage: (conversationId, message) => set((state) => ({
        messages:  {
          ...state.messages,
          [conversationId]: [...(state.messages[conversationId] || []), message]
        }
      })),
      
      updateMessage: (conversationId, messageId, updates) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } :  msg
          )
        }
      })),
      
      removeMessage: (conversationId, messageId) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).filter(
            (msg) => msg.id !== messageId
          )
        }
      })),
      
      prependMessages: (conversationId, messages) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: [...messages, ...(state.messages[conversationId] || [])]
        }
      })),
      
      getMessages: (conversationId) => {
        return get().messages[conversationId] || [];
      },

      // ============================================
      // Typing Indicators
      // ============================================
      typingUsers: {}, // { conversationId: { userId: userInfo } }
      
      setTypingUser: (conversationId, userId, userInfo) => set((state) => ({
        typingUsers:  {
          ...state.typingUsers,
          [conversationId]: {
            ...(state.typingUsers[conversationId] || {}),
            [userId]: userInfo
          }
        }
      })),
      
      removeTypingUser: (conversationId, userId) => set((state) => {
        const conversationTyping = { ...(state.typingUsers[conversationId] || {}) };
        delete conversationTyping[userId];
        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: conversationTyping
          }
        };
      }),
      
      getTypingUsers: (conversationId) => {
        return Object.values(get().typingUsers[conversationId] || {});
      },

      // ============================================
      // Online Users
      // ============================================
      onlineUsers: new Set(),
      
      setUserOnline: (userId) => set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers);
        newOnlineUsers.add(userId);
        return { onlineUsers:  newOnlineUsers };
      }),
      
      setUserOffline: (userId) => set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers);
        newOnlineUsers.delete(userId);
        return { onlineUsers: newOnlineUsers };
      }),
      
      isUserOnline: (userId) => {
        return get().onlineUsers.has(userId);
      },

      // ============================================
      // UI State
      // ============================================
      isSidebarOpen:  true,
      isRightPanelOpen: false,
      isNewChatModalOpen: false,
      isMobileView: false,
      
      toggleSidebar: () => set((state) => ({ isSidebarOpen:  !state.isSidebarOpen })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
      
      toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
      setRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),
      
      setNewChatModalOpen:  (isOpen) => set({ isNewChatModalOpen: isOpen }),
      
      setMobileView: (isMobile) => set({ isMobileView: isMobile }),

      // ============================================
      // Settings
      // ============================================
      settings: {
        soundEnabled: true,
        notificationsEnabled: true,
        theme: 'system',
      },
      
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),

      // ============================================
      // Socket Connection State
      // ============================================
      isSocketConnected: false,
      setSocketConnected: (isConnected) => set({ isSocketConnected: isConnected }),

      // ============================================
      // Reset Store
      // ============================================
      reset:  () => set({
        user: null,
        conversations:  [],
        activeConversationId:  null,
        messages: {},
        typingUsers: {},
        onlineUsers:  new Set(),
        isSocketConnected: false,
      }),
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

export default useStore;