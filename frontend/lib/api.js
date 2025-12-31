import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

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
  }
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
  }
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

export default api;
