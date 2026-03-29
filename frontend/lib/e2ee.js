const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const PBKDF2_ITERATIONS = 100000;
const AES_GCM_IV_BYTES = 12;
const PBKDF2_SALT_BYTES = 16;
const UNLOCK_RETRY_COOLDOWN_MS = 30000;

const privateKeyCache = new Map();
const privateKeyUnlockPromiseCache = new Map();
const unlockSuppressionUntil = new Map();

const toBase64 = (input) => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const fromBase64 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const toHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const derivePasswordAesKey = async (password, saltBytes, iterations) => {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
};

const importRsaPublicKey = async (publicKeyBase64) => {
  return crypto.subtle.importKey(
    "spki",
    fromBase64(publicKeyBase64),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"],
  );
};

const getPrivateKeyCacheId = (userId) => String(userId || "");

export const isE2EEMessage = (message) => {
  return Boolean(
    message?.isEncrypted && message?.encryption?.format === "e2ee-v1",
  );
};

export const clearUnlockedPrivateKey = (userId) => {
  if (!userId) {
    privateKeyCache.clear();
    privateKeyUnlockPromiseCache.clear();
    unlockSuppressionUntil.clear();
    return;
  }

  const cacheId = getPrivateKeyCacheId(userId);
  privateKeyCache.delete(cacheId);
  privateKeyUnlockPromiseCache.delete(cacheId);
  unlockSuppressionUntil.delete(cacheId);
};

export const generateUserKeyMaterial = async ({ password }) => {
  if (!password) {
    throw new Error("Encryption password is required");
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const publicKeyBuffer = await crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey,
  );
  const privateKeyBuffer = await crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey,
  );

  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const aesKey = await derivePasswordAesKey(password, salt, PBKDF2_ITERATIONS);

  const encryptedPrivateKeyBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    privateKeyBuffer,
  );

  const fingerprintBuffer = await crypto.subtle.digest(
    "SHA-256",
    publicKeyBuffer,
  );

  return {
    publicKey: toBase64(publicKeyBuffer),
    fingerprint: toHex(fingerprintBuffer),
    encryptedPrivateKey: toBase64(encryptedPrivateKeyBuffer),
    keyEncryptionSalt: toBase64(salt),
    keyEncryptionIv: toBase64(iv),
    keyEncryptionIterations: PBKDF2_ITERATIONS,
    keyEncryptionAlgorithm: "AES-256-GCM",
    keyEncryptionKdf: "PBKDF2-SHA-256",
  };
};

export const ensureUnlockedPrivateKey = async ({
  userId,
  keyStorage,
  getPassword,
}) => {
  const cacheId = getPrivateKeyCacheId(userId);
  const cached = privateKeyCache.get(cacheId);
  if (cached) {
    return cached;
  }

  const pendingUnlock = privateKeyUnlockPromiseCache.get(cacheId);
  if (pendingUnlock) {
    return pendingUnlock;
  }

  const suppressionUntil = unlockSuppressionUntil.get(cacheId) || 0;
  if (Date.now() < suppressionUntil) {
    throw new Error("Encryption key unlock is temporarily paused");
  }

  const {
    encryptedPrivateKey,
    keyEncryptionSalt,
    keyEncryptionIv,
    keyEncryptionIterations = PBKDF2_ITERATIONS,
  } = keyStorage || {};

  if (!encryptedPrivateKey || !keyEncryptionSalt || !keyEncryptionIv) {
    throw new Error("Encrypted private key is not configured");
  }

  const unlockPromise = (async () => {
    try {
      const password = await Promise.resolve(
        typeof getPassword === "function"
          ? getPassword()
          : window.prompt("Enter your encryption password"),
      );

      if (!password) {
        unlockSuppressionUntil.set(
          cacheId,
          Date.now() + UNLOCK_RETRY_COOLDOWN_MS,
        );
        throw new Error("Encryption password is required");
      }

      const aesKey = await derivePasswordAesKey(
        password,
        fromBase64(keyEncryptionSalt),
        Number(keyEncryptionIterations) || PBKDF2_ITERATIONS,
      );

      const privateKeyPkcs8 = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(keyEncryptionIv),
        },
        aesKey,
        fromBase64(encryptedPrivateKey),
      );

      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privateKeyPkcs8,
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        false,
        ["decrypt"],
      );

      privateKeyCache.set(cacheId, privateKey);
      unlockSuppressionUntil.delete(cacheId);
      return privateKey;
    } catch (error) {
      unlockSuppressionUntil.set(
        cacheId,
        Date.now() + UNLOCK_RETRY_COOLDOWN_MS,
      );
      throw error;
    } finally {
      privateKeyUnlockPromiseCache.delete(cacheId);
    }
  })();

  privateKeyUnlockPromiseCache.set(cacheId, unlockPromise);
  return unlockPromise;
};

export const encryptDirectMessagePayload = async ({
  plaintext,
  senderPublicKey,
  recipientPublicKey,
  senderId,
  recipientId,
  senderFingerprint = "",
  recipientFingerprint = "",
}) => {
  if (!plaintext) {
    throw new Error("Message plaintext is required");
  }

  if (!senderPublicKey || !recipientPublicKey) {
    throw new Error("Sender and recipient public keys are required");
  }

  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(plaintext),
  );

  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);

  const senderPublic = await importRsaPublicKey(senderPublicKey);
  const recipientPublic = await importRsaPublicKey(recipientPublicKey);

  const senderWrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    senderPublic,
    rawAesKey,
  );

  const recipientWrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublic,
    rawAesKey,
  );

  return {
    content: toBase64(ciphertextBuffer),
    e2ee: {
      format: "e2ee-v1",
      algorithm: "AES-256-GCM",
      keyExchange: "RSA-OAEP-SHA-256",
      iv: toBase64(iv),
      senderWrappedKey: toBase64(senderWrappedKey),
      recipientWrappedKey: toBase64(recipientWrappedKey),
      senderId: String(senderId || ""),
      recipientId: String(recipientId || ""),
      senderFingerprint,
      recipientFingerprint,
    },
  };
};

export const decryptDirectMessagePayload = async ({
  message,
  currentUserId,
  keyStorage,
  getPassword,
}) => {
  if (!isE2EEMessage(message)) {
    return message?.content || "";
  }

  const encryption = message.encryption || {};
  const privateKey = await ensureUnlockedPrivateKey({
    userId: currentUserId,
    keyStorage,
    getPassword,
  });

  let wrappedKeyBase64 = "";
  const currentId = String(currentUserId || "");

  if (currentId && currentId === String(encryption.senderId || "")) {
    wrappedKeyBase64 = encryption.senderWrappedKey || "";
  } else if (currentId && currentId === String(encryption.recipientId || "")) {
    wrappedKeyBase64 = encryption.recipientWrappedKey || "";
  } else {
    wrappedKeyBase64 =
      encryption.recipientWrappedKey || encryption.senderWrappedKey || "";
  }

  if (!wrappedKeyBase64 || !encryption.iv || !message.content) {
    throw new Error("Message encryption payload is incomplete");
  }

  const rawAesKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromBase64(wrappedKeyBase64),
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    rawAesKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(encryption.iv),
    },
    aesKey,
    fromBase64(message.content),
  );

  return textDecoder.decode(plaintextBuffer);
};
