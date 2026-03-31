import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const DEFAULT_API_TIMEOUT_MS = 10000;
const BLOCKCHAIN_API_TIMEOUT_MS = 30000;

const createApiClient = (timeout) =>
  axios.create({
    baseURL: `${API_URL}/api`,
    timeout,
    headers: {
      "Content-Type": "application/json",
    },
  });

// Create axios instance
const api = createApiClient(DEFAULT_API_TIMEOUT_MS);
const blockchainApi = createApiClient(BLOCKCHAIN_API_TIMEOUT_MS);

// Token storage for client-side
let authToken = null;

/**
 * Set authentication token
 */
export const setAuthToken = (token) => {
  authToken = token;
};

/**
 * Request interceptor to add auth token
 */
api.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

blockchainApi.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Response interceptor for error handling
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error || error.message || "An error occurred";

    // Log error in development
    if (process.env.NODE_ENV === "development") {
      console.error("API Error:", message);
    }

    return Promise.reject(new Error(message));
  },
);

blockchainApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error || error.message || "An error occurred";

    // Log error in development
    if (process.env.NODE_ENV === "development") {
      console.error("API Error:", message);
    }

    return Promise.reject(new Error(message));
  },
);

// ============================================
// Auth API
// ============================================
export const authAPI = {
  syncUser: () => api.post("/auth/sync"),
  getMe: () => api.get("/auth/me"),
  refreshUser: () => api.post("/auth/refresh"),
};

// ============================================
// User API
// ============================================
export const userAPI = {
  searchUsers: (query) => api.get(`/users?search=${encodeURIComponent(query)}`),
  getUser: (userId) => api.get(`/users/${userId}`),
  updateProfile: (data) => api.put("/users/profile", data),
  getContacts: () => api.get("/users/contacts"),
  addContact: (userId) => api.post(`/users/contacts/${userId}`),
  removeContact: (userId) => api.delete(`/users/contacts/${userId}`),
};

// ============================================
// Conversation API
// ============================================
export const conversationAPI = {
  getAll: (page = 1, limit = 20) =>
    api.get(`/conversations?page=${page}&limit=${limit}`),
  getOne: (conversationId) => api.get(`/conversations/${conversationId}`),
  create: (participantIds, type = "direct", groupName = null) =>
    api.post("/conversations", { participantIds, type, groupName }),
  markAsRead: (conversationId) =>
    api.put(`/conversations/${conversationId}/read`),
  pin: (conversationId, pinned) =>
    api.put(`/conversations/${conversationId}/pin`, { pinned }),
  delete: (conversationId) => api.delete(`/conversations/${conversationId}`),
};

// ============================================
// Message API
// ============================================
export const messageAPI = {
  getMessages: (conversationId, page = 1, limit = 50) =>
    api.get(`/messages/${conversationId}?page=${page}&limit=${limit}`),
  sendMessage: (conversationId, content, type = "text", replyTo = null) =>
    api.post(`/messages/${conversationId}`, { content, type, replyTo }),
  markAsRead: (messageId) => api.put(`/messages/${messageId}/read`),
  editMessage: (messageId, content) =>
    api.put(`/messages/${messageId}`, { content }),
  deleteMessage: (messageId, forEveryone = false) =>
    api.delete(`/messages/${messageId}?forEveryone=${forEveryone}`),
  addReaction: (messageId, emoji) =>
    api.post(`/messages/${messageId}/reaction`, { emoji }),
};

// ============================================
// Upload API
// ============================================
export const uploadAPI = {
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return api.post("/upload/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/upload/file", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  deleteAvatar: () => api.delete("/upload/avatar"),
};

// ============================================
// Call API
// ============================================
export const callAPI = {
  getHistory: () => api.get("/calls/history"),
};

// ============================================
// Group API
// ============================================
export const groupAPI = {
  getMyGroups: (page = 1, limit = 20) =>
    api.get(`/groups/my?page=${page}&limit=${limit}`),
  discover: (q = "", limit = 20) =>
    api.get(`/groups/discover?q=${encodeURIComponent(q)}&limit=${limit}`),
  create: (payload) => api.post("/groups/create", payload),
  registerOnChain: (groupId, payload) =>
    api.post(`/groups/${groupId}/register-onchain`, payload),
  join: (groupId, payload = {}) => api.post(`/groups/${groupId}/join`, payload),
  getOne: (groupId) => api.get(`/groups/${groupId}`),
  addMember: (groupId, memberId) =>
    api.post(`/groups/${groupId}/add-member`, { memberId }),
  removeMember: (groupId, memberId) =>
    api.post(`/groups/${groupId}/remove-member`, { memberId }),
  update: (groupId, payload) => api.put(`/groups/${groupId}/update`, payload),
  leave: (groupId) => api.post(`/groups/${groupId}/leave`),
  delete: (groupId) => api.delete(`/groups/${groupId}/delete`),
  getMessages: (groupId, page = 1, limit = 50) =>
    api.get(`/groups/${groupId}/messages?page=${page}&limit=${limit}`),
  sendMessage: (groupId, payload) =>
    api.post(`/groups/${groupId}/messages`, payload),
};

// ============================================
// Blockchain Key API
// ============================================
export const keyAPI = {
  register: (payload) => blockchainApi.post("/keys/register", payload),
  getMyStatus: () => blockchainApi.get("/keys/status/me"),
  getStatus: (userId) => blockchainApi.get(`/keys/status/${userId}`),
};

// ============================================
// Anchor API
// ============================================
export const anchorAPI = {
  getConversationAnchor: (conversationId) =>
    blockchainApi.get(`/anchor/conversation/${conversationId}`),
  getGroupAnchor: (groupId) => blockchainApi.get(`/anchor/group/${groupId}`),
  anchorConversationNow: (conversationId) =>
    blockchainApi.post(`/anchor/conversation/${conversationId}/now`),
  anchorGroupNow: (groupId) =>
    blockchainApi.post(`/anchor/group/${groupId}/now`),
  verifyConversation: (conversationId) =>
    blockchainApi.get(`/anchor/conversation/${conversationId}/verify`),
  verifyGroup: (groupId) =>
    blockchainApi.get(`/anchor/group/${groupId}/verify`),
};

export default api;
