"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { ethers } from "ethers";
import { useStore } from "@/store/useStore";
import { keyAPI, messageAPI, setAuthToken } from "@/lib/api";
import { BLOCKCHAIN_CONFIG } from "@/lib/blockchainConfig";
import { buildUserKeyMaterial, registerKeyOnChain } from "@/lib/keyRegistry";
import {
  sendMessage as socketSendMessage,
  startTyping,
  stopTyping,
} from "@/lib/socket";
import {
  clearUnlockedPrivateKey,
  decryptDirectMessagePayload,
  encryptDirectMessagePayload,
  isE2EEMessage,
} from "@/lib/e2ee";
import toast from "react-hot-toast";
import { debounce } from "@/lib/utils";

export function useMessages(conversationId) {
  const { getToken } = useAuth();
  const {
    conversations,
    setMessages,
    addMessage,
    updateMessage,
    updateConversation,
    removeMessage,
    prependMessages,
    getMessages,
    user,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const typingTimeoutRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const myKeyStatusRef = useRef(null);
  const recipientKeyStatusRef = useRef(new Map());
  const previousUserIdRef = useRef(null);
  const encryptionPasswordRef = useRef("");
  const passwordPromptPromiseRef = useRef(null);
  const keyRegistrationPromiseRef = useRef(null);
  const keyBootstrapAttemptedRef = useRef(false);

  // Get messages for current conversation
  const conversationMessages = getMessages(conversationId);
  const activeConversation = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  const recipientId =
    activeConversation?.otherParticipant?.id ||
    activeConversation?.otherParticipant?._id ||
    "";

  useEffect(() => {
    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;

    if (previousUserId && previousUserId !== currentUserId) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`chat:e2ee-password:${previousUserId}`);
        sessionStorage.removeItem(
          `chat:key-bootstrap-attempted:${previousUserId}`,
        );
      }
      encryptionPasswordRef.current = "";
      passwordPromptPromiseRef.current = null;
      keyRegistrationPromiseRef.current = null;
      keyBootstrapAttemptedRef.current = false;
    }

    if (previousUserId && previousUserId !== currentUserId) {
      myKeyStatusRef.current = null;
      recipientKeyStatusRef.current.clear();
      clearUnlockedPrivateKey(previousUserId);
    }

    previousUserIdRef.current = currentUserId;

    if (currentUserId && typeof window !== "undefined") {
      keyBootstrapAttemptedRef.current =
        sessionStorage.getItem(
          `chat:key-bootstrap-attempted:${currentUserId}`,
        ) === "1";
    }
  }, [user?.id]);

  const getRegistrationPassword = useCallback(async () => {
    if (encryptionPasswordRef.current) {
      return encryptionPasswordRef.current;
    }

    const passwordStorageKey = `chat:e2ee-password:${user?.id || "anon"}`;

    if (typeof window !== "undefined") {
      const storedPassword = sessionStorage.getItem(passwordStorageKey) || "";
      if (storedPassword) {
        encryptionPasswordRef.current = storedPassword;
        return storedPassword;
      }
    }

    const password = window.prompt(
      "Create an encryption password (you will use this to unlock your chat key)",
    );
    if (!password) {
      throw new Error("Encryption password is required");
    }

    encryptionPasswordRef.current = password;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(passwordStorageKey, password);
    }

    return password;
  }, [user?.id]);

  const getEncryptionPassword = useCallback(async () => {
    if (encryptionPasswordRef.current) {
      return encryptionPasswordRef.current;
    }

    const passwordStorageKey = `chat:e2ee-password:${user?.id || "anon"}`;

    if (typeof window !== "undefined") {
      const storedPassword = sessionStorage.getItem(passwordStorageKey) || "";
      if (storedPassword) {
        encryptionPasswordRef.current = storedPassword;
        return storedPassword;
      }
    }

    if (passwordPromptPromiseRef.current) {
      return passwordPromptPromiseRef.current;
    }

    passwordPromptPromiseRef.current = Promise.resolve()
      .then(() => window.prompt("Enter your encryption password"))
      .then((password) => {
        if (!password) {
          throw new Error("Encryption password is required");
        }

        encryptionPasswordRef.current = password;
        if (typeof window !== "undefined") {
          sessionStorage.setItem(passwordStorageKey, password);
        }

        return password;
      })
      .finally(() => {
        passwordPromptPromiseRef.current = null;
      });

    return passwordPromptPromiseRef.current;
  }, [user?.id]);

  const ensureAuthToken = useCallback(async () => {
    const token = await getToken();
    setAuthToken(token);
    return token;
  }, [getToken]);

  const getWalletAddressForRegistration = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("Connect MetaMask to register your encryption key");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== BLOCKCHAIN_CONFIG.chainId) {
      throw new Error(
        "Switch MetaMask to Sepolia to register your encryption key",
      );
    }

    const signer = await provider.getSigner();
    return signer.getAddress();
  }, []);

  const getMyKeyStatus = useCallback(async () => {
    if (myKeyStatusRef.current) {
      return myKeyStatusRef.current;
    }

    await ensureAuthToken();
    const response = await keyAPI.getMyStatus();
    const status = response.data?.status;

    if (!status) {
      throw new Error("Your key status is unavailable");
    }

    myKeyStatusRef.current = status;
    return status;
  }, [ensureAuthToken]);

  const registerMyKeyIfNeeded = useCallback(async () => {
    if (!user?.id) {
      throw new Error("User profile not ready for key registration");
    }

    if (keyRegistrationPromiseRef.current) {
      return keyRegistrationPromiseRef.current;
    }

    const currentStatus = await getMyKeyStatus();
    if (currentStatus?.verified && currentStatus?.onChain?.publicKey) {
      return currentStatus;
    }

    if (keyBootstrapAttemptedRef.current) {
      throw new Error(
        "Key onboarding already prompted this session. Complete key setup from Settings.",
      );
    }

    keyBootstrapAttemptedRef.current = true;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`chat:key-bootstrap-attempted:${user.id}`, "1");
    }

    keyRegistrationPromiseRef.current = (async () => {
      const walletAddress = await getWalletAddressForRegistration();
      const password = await getRegistrationPassword();
      const keyMaterial = await buildUserKeyMaterial({ password });

      const { txHash } = await registerKeyOnChain({
        userId: user.id,
        publicKey: keyMaterial.publicKey,
        fingerprint: keyMaterial.fingerprint,
      });

      await ensureAuthToken();
      await keyAPI.register({
        publicKey: keyMaterial.publicKey,
        fingerprint: keyMaterial.fingerprint,
        walletAddress,
        txHash,
        encryptedPrivateKey: keyMaterial.encryptedPrivateKey,
        keyEncryptionSalt: keyMaterial.keyEncryptionSalt,
        keyEncryptionIv: keyMaterial.keyEncryptionIv,
        keyEncryptionIterations: keyMaterial.keyEncryptionIterations,
        keyEncryptionAlgorithm: keyMaterial.keyEncryptionAlgorithm,
        keyEncryptionKdf: keyMaterial.keyEncryptionKdf,
      });

      const refreshResponse = await keyAPI.getMyStatus();
      const refreshedStatus = refreshResponse.data?.status;

      if (!refreshedStatus?.verified || !refreshedStatus?.onChain?.publicKey) {
        throw new Error("Key registration verification failed");
      }

      myKeyStatusRef.current = refreshedStatus;
      toast.success("Encryption key registered for this account");
      return refreshedStatus;
    })().finally(() => {
      keyRegistrationPromiseRef.current = null;
    });

    return keyRegistrationPromiseRef.current;
  }, [
    ensureAuthToken,
    getMyKeyStatus,
    getRegistrationPassword,
    getWalletAddressForRegistration,
    user?.id,
  ]);

  const getRecipientKeyStatus = useCallback(
    async (targetUserId) => {
      const normalizedUserId = String(targetUserId || "");
      if (!normalizedUserId) {
        throw new Error("Recipient user ID is required for encrypted chat");
      }

      const cachedStatus = recipientKeyStatusRef.current.get(normalizedUserId);
      if (cachedStatus) {
        return cachedStatus;
      }

      await ensureAuthToken();
      const response = await keyAPI.getStatus(normalizedUserId);
      const status = response.data?.status;

      if (!status) {
        throw new Error("Recipient key status is unavailable");
      }

      recipientKeyStatusRef.current.set(normalizedUserId, status);
      return status;
    },
    [ensureAuthToken],
  );

  const decryptMessageForDisplay = useCallback(
    async (message) => {
      if (!isE2EEMessage(message)) {
        return message;
      }

      try {
        const myStatus = await getMyKeyStatus();
        const plaintext = await decryptDirectMessagePayload({
          message,
          currentUserId: user?.id,
          keyStorage: myStatus.localKeyStorage,
          getPassword: getEncryptionPassword,
        });

        let decryptedReply = message.replyTo;
        if (isE2EEMessage(message.replyTo)) {
          const replyPlaintext = await decryptDirectMessagePayload({
            message: message.replyTo,
            currentUserId: user?.id,
            keyStorage: myStatus.localKeyStorage,
            getPassword: getEncryptionPassword,
          });

          decryptedReply = {
            ...message.replyTo,
            content: replyPlaintext,
            isLocallyDecrypted: true,
          };
        }

        return {
          ...message,
          content: plaintext,
          replyTo: decryptedReply,
          isLocallyDecrypted: true,
          decryptionFailed: false,
        };
      } catch {
        const passwordStorageKey = `chat:e2ee-password:${user?.id || "anon"}`;
        encryptionPasswordRef.current = "";
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(passwordStorageKey);
        }

        return {
          ...message,
          content: "[Unable to decrypt message]",
          decryptionFailed: true,
        };
      }
    },
    [getEncryptionPassword, getMyKeyStatus, user?.id],
  );

  const hydrateMessagesForDisplay = useCallback(
    async (incomingMessages) => {
      return Promise.all(
        (incomingMessages || []).map((message) =>
          decryptMessageForDisplay(message),
        ),
      );
    },
    [decryptMessageForDisplay],
  );

  const syncConversationPreview = useCallback(
    (messagesList) => {
      if (
        !conversationId ||
        !Array.isArray(messagesList) ||
        messagesList.length === 0
      ) {
        return;
      }

      const latestMessage = messagesList[messagesList.length - 1];
      if (!latestMessage) {
        return;
      }

      updateConversation(conversationId, {
        lastMessage: {
          content:
            latestMessage.type === "text"
              ? latestMessage.content
              : `[${latestMessage.type || "file"}]`,
          sender: latestMessage.sender,
          timestamp: latestMessage.createdAt,
          type: latestMessage.type || "text",
        },
      });
    },
    [conversationId, updateConversation],
  );

  // Update last message ID when messages change
  useEffect(() => {
    if (conversationMessages && conversationMessages.length > 0) {
      lastMessageIdRef.current =
        conversationMessages[conversationMessages.length - 1].id;
    }
  }, [conversationMessages]);

  // Fetch messages
  const fetchMessages = useCallback(
    async (pageNum = 1, append = false) => {
      if (!conversationId) return;

      try {
        setIsLoading(true);
        await ensureAuthToken();

        const response = await messageAPI.getMessages(
          conversationId,
          pageNum,
          50,
        );
        const fetchedMessages = await hydrateMessagesForDisplay(
          response.data || [],
        );

        if (append) {
          prependMessages(conversationId, fetchedMessages);
        } else {
          setMessages(conversationId, fetchedMessages);
          syncConversationPreview(fetchedMessages);
        }

        setHasMore(response.pagination?.hasNextPage || false);
        setPage(pageNum);
      } catch (err) {
        toast.error("Failed to load messages");
      } finally {
        setIsLoading(false);
      }
    },
    [
      conversationId,
      ensureAuthToken,
      hydrateMessagesForDisplay,
      prependMessages,
      setMessages,
    ],
  );

  // Load more messages (infinite scroll)
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    await fetchMessages(page + 1, true);
  }, [isLoading, hasMore, page, fetchMessages]);

  // Poll for new messages every 3 seconds
  const pollForNewMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      await ensureAuthToken();

      const response = await messageAPI.getMessages(conversationId, 1, 50);
      const fetchedMessages = await hydrateMessagesForDisplay(
        response.data || [],
      );

      if (fetchedMessages.length > 0) {
        const latestMessageId = fetchedMessages[fetchedMessages.length - 1].id;

        // Check if there are new messages
        if (
          lastMessageIdRef.current &&
          latestMessageId !== lastMessageIdRef.current
        ) {
          console.log("📩 Polling detected new messages");
          setMessages(conversationId, fetchedMessages);
          syncConversationPreview(fetchedMessages);
          lastMessageIdRef.current = latestMessageId;
        } else if (!lastMessageIdRef.current) {
          // First load
          lastMessageIdRef.current = latestMessageId;
          syncConversationPreview(fetchedMessages);
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, [
    conversationId,
    ensureAuthToken,
    hydrateMessagesForDisplay,
    setMessages,
    syncConversationPreview,
  ]);

  // Start polling when conversation changes
  useEffect(() => {
    if (!conversationId) return;

    console.log(
      "🔄 Starting message polling for conversation:",
      conversationId,
    );

    // Initial fetch
    fetchMessages(1, false);

    // Start polling every 3 seconds
    pollingIntervalRef.current = setInterval(pollForNewMessages, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        console.log("🛑 Stopping message polling");
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [conversationId, fetchMessages, pollForNewMessages]);

  useEffect(() => {
    if (!conversationId || !user?.id || activeConversation?.type !== "direct") {
      return;
    }

    if (keyBootstrapAttemptedRef.current) {
      return;
    }

    (async () => {
      try {
        const myStatus = await getMyKeyStatus();
        if (!myStatus?.verified || !myStatus?.onChain?.publicKey) {
          await registerMyKeyIfNeeded();
        }
      } catch (error) {
        // Keep one-prompt-per-session behavior; user can retry from Settings.
        console.debug("Key bootstrap skipped:", error?.message || error);
      }
    })();
  }, [
    activeConversation?.type,
    conversationId,
    getMyKeyStatus,
    registerMyKeyIfNeeded,
    user?.id,
  ]);

  // Send message
  const sendMessage = useCallback(
    async (content, type = "text", replyTo = null, fileUrl = null) => {
      const plainContent = (content || "").trim();
      if (!conversationId || (!plainContent && !fileUrl)) return;

      let optimisticMessage = null;

      try {
        setIsSending(true);

        // Stop typing indicator
        stopTyping(conversationId);

        // Create optimistic message
        optimisticMessage = {
          id: `temp-${Date.now()}`,
          conversationId,
          sender: {
            id: user?.id,
            clerkId: user?.clerkId,
            username: user?.username,
            firstName: user?.firstName,
            lastName: user?.lastName,
            avatar: user?.avatar,
          },
          content: plainContent || fileUrl,
          type,
          status: "sending",
          replyTo,
          fileUrl,
          createdAt: new Date().toISOString(),
          isOptimistic: true,
        };

        // Add optimistic message
        addMessage(conversationId, optimisticMessage);

        let outgoingContent = plainContent || fileUrl;
        let e2eePayload = null;

        const shouldEncryptDirectMessage =
          activeConversation?.type === "direct" &&
          type === "text" &&
          !fileUrl &&
          typeof outgoingContent === "string" &&
          outgoingContent.length > 0;

        if (shouldEncryptDirectMessage) {
          if (!recipientId) {
            throw new Error("Recipient could not be resolved for encryption");
          }

          let myStatus = await getMyKeyStatus();
          if (
            !myStatus?.verified ||
            !myStatus?.onChain?.publicKey ||
            !myStatus?.localKeyStorage?.encryptedPrivateKey
          ) {
            myStatus = await registerMyKeyIfNeeded();
          }

          const recipientStatus = await getRecipientKeyStatus(recipientId);

          if (
            !myStatus?.verified ||
            !myStatus?.onChain?.publicKey ||
            !myStatus?.localKeyStorage?.encryptedPrivateKey
          ) {
            throw new Error(
              "Register your key pair in Settings before chatting",
            );
          }

          if (
            !recipientStatus?.verified ||
            !recipientStatus?.onChain?.publicKey
          ) {
            throw new Error("Recipient key is not verified on-chain");
          }

          const encrypted = await encryptDirectMessagePayload({
            plaintext: outgoingContent,
            senderPublicKey: myStatus.onChain.publicKey,
            recipientPublicKey: recipientStatus.onChain.publicKey,
            senderId: user?.id,
            recipientId,
            senderFingerprint: myStatus.onChain.fingerprint || "",
            recipientFingerprint: recipientStatus.onChain.fingerprint || "",
          });

          outgoingContent = encrypted.content;
          e2eePayload = encrypted.e2ee;
        }

        // Send via socket
        const response = await socketSendMessage({
          conversationId,
          content: outgoingContent,
          type,
          replyTo,
          fileUrl,
          e2ee: e2eePayload,
        });

        // Replace optimistic message with real one
        if (response.message) {
          removeMessage(conversationId, optimisticMessage.id);

          const finalMessage = e2eePayload
            ? {
                ...response.message,
                content: plainContent,
                isLocallyDecrypted: true,
                decryptionFailed: false,
              }
            : await decryptMessageForDisplay(response.message);

          addMessage(conversationId, finalMessage);
          syncConversationPreview([
            ...(getMessages(conversationId) || []).filter(
              (message) => message.id !== optimisticMessage.id,
            ),
            finalMessage,
          ]);
        }

        return response.message;
      } catch (err) {
        // Remove optimistic message on error
        if (optimisticMessage?.id) {
          removeMessage(conversationId, optimisticMessage.id);
        }
        toast.error(err?.message || "Failed to send message");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [
      activeConversation?.type,
      addMessage,
      conversationId,
      decryptMessageForDisplay,
      getMyKeyStatus,
      getRecipientKeyStatus,
      registerMyKeyIfNeeded,
      getMessages,
      recipientId,
      removeMessage,
      syncConversationPreview,
      user,
    ],
  );

  // Handle typing
  const handleTyping = useCallback(
    debounce(() => {
      if (!conversationId) return;

      startTyping(conversationId);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(conversationId);
      }, 2000);
    }, 300),
    [conversationId],
  );

  // Mark message as read
  const markAsRead = useCallback(
    async (messageId) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await messageAPI.markAsRead(messageId);
        updateMessage(conversationId, messageId, { status: "read" });
      } catch (err) {
        console.error("Failed to mark message as read:", err);
      }
    },
    [conversationId, getToken, updateMessage],
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId, newContent) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await messageAPI.editMessage(messageId, newContent);
        updateMessage(conversationId, messageId, {
          content: newContent,
          isEdited: true,
        });
        toast.success("Message edited");
      } catch (err) {
        toast.error("Failed to edit message");
      }
    },
    [conversationId, getToken, updateMessage],
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId, forEveryone = false) => {
      try {
        const token = await getToken();
        setAuthToken(token);

        await messageAPI.deleteMessage(messageId, forEveryone);

        if (forEveryone) {
          removeMessage(conversationId, messageId);
        } else {
          updateMessage(conversationId, messageId, { isDeleted: true });
        }

        toast.success("Message deleted");
      } catch (err) {
        toast.error("Failed to delete message");
      }
    },
    [conversationId, getToken, removeMessage, updateMessage],
  );

  // Add reaction
  const addReaction = useCallback(
    async (messageId, emoji) => {
      try {
        await ensureAuthToken();

        await messageAPI.addReaction(messageId, emoji);
      } catch (err) {
        toast.error("Failed to add reaction");
      }
    },
    [ensureAuthToken],
  );

  return {
    messages: conversationMessages,
    isLoading,
    isSending,
    hasMore,
    fetchMessages,
    loadMore,
    sendMessage,
    handleTyping,
    markAsRead,
    editMessage,
    deleteMessage,
    addReaction,
  };
}

export default useMessages;
