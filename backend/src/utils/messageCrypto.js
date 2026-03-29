import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const DEFAULT_KEY_VERSION = "v1";
const FALLBACK_DEV_KEY = "dev-message-encryption-key-change-me";

let cachedKey = null;

const getEncryptionSecret = () => {
  return (
    process.env.MESSAGE_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY ||
    FALLBACK_DEV_KEY
  );
};

const getKeyVersion = () => {
  return process.env.MESSAGE_ENCRYPTION_KEY_VERSION || DEFAULT_KEY_VERSION;
};

const getEncryptionKey = () => {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = String(getEncryptionSecret());
  cachedKey = crypto.createHash("sha256").update(secret).digest();
  return cachedKey;
};

export const encryptMessageContent = (plaintext) => {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Message plaintext is required for encryption");
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    algorithm: ALGORITHM,
    keyVersion: getKeyVersion(),
    encryptedAt: new Date(),
  };
};

export const decryptMessageContent = ({
  ciphertext,
  iv,
  authTag,
  algorithm,
}) => {
  if (!ciphertext || !iv || !authTag) {
    throw new Error("Encrypted message payload is incomplete");
  }

  if ((algorithm || ALGORITHM) !== ALGORITHM) {
    throw new Error("Unsupported encryption algorithm");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

export const decryptMessageDocument = (message) => {
  if (!message?.isEncrypted) {
    return message?.content || "";
  }

  return decryptMessageContent({
    ciphertext: message.content,
    iv: message.encryption?.iv,
    authTag: message.encryption?.authTag,
    algorithm: message.encryption?.algorithm,
  });
};
