import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useStore = create(
  persist(
    (set, get) => ({
      // ============================================
      // User State
      // ============================================
      user: null,
      setUser: (user) => set({ user }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      clearUser: () => set({ user: null }),

      // ============================================
      // Conversations State
      // ============================================
      conversations: [],
      activeConversationId: null,

      setConversations: (conversations) => set({ conversations }),

      addConversation: (conversation) =>
        set((state) => ({
          conversations: [
            conversation,
            ...state.conversations.filter((c) => c.id !== conversation.id),
          ],
        })),

      updateConversation: (conversationId, updates) =>
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId ? { ...conv, ...updates } : conv,
          ),
        })),

      removeConversation: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.filter(
            (conv) => conv.id !== conversationId,
          ),
          activeConversationId:
            state.activeConversationId === conversationId
              ? null
              : state.activeConversationId,
        })),

      setActiveConversation: (conversationId) =>
        set({ activeConversationId: conversationId }),

      getActiveConversation: () => {
        const state = get();
        return state.conversations.find(
          (c) => c.id === state.activeConversationId,
        );
      },

      // ============================================
      // Groups State
      // ============================================
      groups: [],
      activeGroupId: null,
      groupMessages: {}, // { groupId: Message[] }
      groupUnreadCounts: {}, // { groupId: number }

      setGroups: (groups) => set({ groups }),

      addGroup: (group) =>
        set((state) => ({
          groups: [group, ...state.groups.filter((g) => g.id !== group.id)],
        })),

      updateGroup: (groupId, updates) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId ? { ...group, ...updates } : group,
          ),
        })),

      removeGroup: (groupId) =>
        set((state) => {
          const nextUnread = { ...state.groupUnreadCounts };
          const nextMessages = { ...state.groupMessages };
          delete nextUnread[groupId];
          delete nextMessages[groupId];

          return {
            groups: state.groups.filter((group) => group.id !== groupId),
            activeGroupId:
              state.activeGroupId === groupId ? null : state.activeGroupId,
            groupUnreadCounts: nextUnread,
            groupMessages: nextMessages,
          };
        }),

      setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

      getActiveGroup: () => {
        const state = get();
        return state.groups.find((g) => g.id === state.activeGroupId) || null;
      },

      setGroupMessages: (groupId, messages) =>
        set((state) => ({
          groupMessages: {
            ...state.groupMessages,
            [groupId]: messages,
          },
        })),

      addGroupMessage: (groupId, message) =>
        set((state) => {
          const currentMessages = state.groupMessages[groupId] || [];
          const existingIndex = currentMessages.findIndex(
            (item) => item.id === message.id,
          );

          if (existingIndex >= 0) {
            const nextMessages = currentMessages.map((item, index) =>
              index === existingIndex ? { ...item, ...message } : item,
            );

            return {
              groupMessages: {
                ...state.groupMessages,
                [groupId]: nextMessages,
              },
            };
          }

          return {
            groupMessages: {
              ...state.groupMessages,
              [groupId]: [...currentMessages, message],
            },
          };
        }),

      prependGroupMessages: (groupId, messages) =>
        set((state) => ({
          groupMessages: {
            ...state.groupMessages,
            [groupId]: [...messages, ...(state.groupMessages[groupId] || [])],
          },
        })),

      updateGroupMessage: (groupId, messageId, updates) =>
        set((state) => ({
          groupMessages: {
            ...state.groupMessages,
            [groupId]: (state.groupMessages[groupId] || []).map((message) =>
              message.id === messageId ? { ...message, ...updates } : message,
            ),
          },
        })),

      getGroupMessages: (groupId) => get().groupMessages[groupId] || [],

      setGroupUnread: (groupId, count) =>
        set((state) => ({
          groupUnreadCounts: {
            ...state.groupUnreadCounts,
            [groupId]: Math.max(0, count || 0),
          },
        })),

      incrementGroupUnread: (groupId) =>
        set((state) => ({
          groupUnreadCounts: {
            ...state.groupUnreadCounts,
            [groupId]: (state.groupUnreadCounts[groupId] || 0) + 1,
          },
        })),

      clearGroupUnread: (groupId) =>
        set((state) => ({
          groupUnreadCounts: {
            ...state.groupUnreadCounts,
            [groupId]: 0,
          },
        })),

      // ============================================
      // Messages State
      // ============================================
      messages: {}, // { conversationId: Message[] }

      setMessages: (conversationId, messages) =>
        set((state) => ({
          messages: { ...state.messages, [conversationId]: messages },
        })),

      addMessage: (conversationId, message) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [
              ...(state.messages[conversationId] || []),
              message,
            ],
          },
        })),

      updateMessage: (conversationId, messageId, updates) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).map(
              (msg) => (msg.id === messageId ? { ...msg, ...updates } : msg),
            ),
          },
        })),

      removeMessage: (conversationId, messageId) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).filter(
              (msg) => msg.id !== messageId,
            ),
          },
        })),

      prependMessages: (conversationId, messages) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [
              ...messages,
              ...(state.messages[conversationId] || []),
            ],
          },
        })),

      getMessages: (conversationId) => {
        return get().messages[conversationId] || [];
      },

      // ============================================
      // Typing Indicators
      // ============================================
      typingUsers: {}, // { conversationId: { userId: userInfo } }

      setTypingUser: (conversationId, userId, userInfo) =>
        set((state) => ({
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: {
              ...(state.typingUsers[conversationId] || {}),
              [userId]: userInfo,
            },
          },
        })),

      removeTypingUser: (conversationId, userId) =>
        set((state) => {
          const conversationTyping = {
            ...(state.typingUsers[conversationId] || {}),
          };
          delete conversationTyping[userId];
          return {
            typingUsers: {
              ...state.typingUsers,
              [conversationId]: conversationTyping,
            },
          };
        }),

      getTypingUsers: (conversationId) => {
        return Object.values(get().typingUsers[conversationId] || {});
      },

      // ============================================
      // Online Users
      // ============================================
      onlineUsers: new Set(),
      inCallUsers: new Set(),

      setUserOnline: (userId) =>
        set((state) => {
          const newOnlineUsers = new Set(state.onlineUsers);
          newOnlineUsers.add(userId);
          return { onlineUsers: newOnlineUsers };
        }),

      setUserOffline: (userId) =>
        set((state) => {
          const newOnlineUsers = new Set(state.onlineUsers);
          newOnlineUsers.delete(userId);
          return { onlineUsers: newOnlineUsers };
        }),

      isUserOnline: (userId) => {
        return get().onlineUsers.has(userId);
      },

      setUserInCall: (userId) =>
        set((state) => {
          const nextInCallUsers = new Set(state.inCallUsers);
          nextInCallUsers.add(userId);
          return { inCallUsers: nextInCallUsers };
        }),

      setUserCallEnded: (userId) =>
        set((state) => {
          const nextInCallUsers = new Set(state.inCallUsers);
          nextInCallUsers.delete(userId);
          return { inCallUsers: nextInCallUsers };
        }),

      isUserInCall: (userId) => {
        return get().inCallUsers.has(userId);
      },

      // ============================================
      // UI State
      // ============================================
      isSidebarOpen: true,
      isRightPanelOpen: false,
      isNewChatModalOpen: false,
      isMobileView: false,

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

      toggleRightPanel: () =>
        set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
      setRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),

      setNewChatModalOpen: (isOpen) => set({ isNewChatModalOpen: isOpen }),

      setMobileView: (isMobile) => set({ isMobileView: isMobile }),

      // ============================================
      // Settings
      // ============================================
      settings: {
        soundEnabled: true,
        notificationsEnabled: true,
        theme: "system",
      },

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      // ============================================
      // Socket Connection State
      // ============================================
      isSocketConnected: false,
      setSocketConnected: (isConnected) =>
        set({ isSocketConnected: isConnected }),

      // ============================================
      // Reset Store
      // ============================================
      reset: () =>
        set({
          user: null,
          conversations: [],
          activeConversationId: null,
          groups: [],
          activeGroupId: null,
          messages: {},
          groupMessages: {},
          groupUnreadCounts: {},
          typingUsers: {},
          onlineUsers: new Set(),
          inCallUsers: new Set(),
          isSocketConnected: false,
        }),
    }),
    {
      name: "chat-store",
      partialize: (state) => ({
        settings: state.settings,
      }),
    },
  ),
);

export default useStore;
