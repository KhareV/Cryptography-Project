import crypto from "crypto";

const normalizeHex = (value) => {
  if (!value) return "";
  return String(value).replace(/^0x/i, "").toLowerCase();
};

const sha256Hex = (value) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

export const computeMessageHash = (message) => {
  const payload = {
    id: String(message?._id || message?.id || ""),
    data: message?.encryptedData ?? "",
    sender: String(message?.senderId || ""),
    ts: message?.timestamp
      ? new Date(message.timestamp).toISOString()
      : new Date(0).toISOString(),
  };

  return sha256Hex(JSON.stringify(payload));
};

export const computeMerkleRoot = (hashes = []) => {
  if (!Array.isArray(hashes) || hashes.length === 0) {
    return null;
  }

  if (hashes.length === 1) {
    return normalizeHex(hashes[0]);
  }

  let level = hashes.map((hash) => normalizeHex(hash)).filter(Boolean);

  if (level.length === 0) {
    return null;
  }

  while (level.length > 1) {
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1]);
    }

    const nextLevel = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1];
      nextLevel.push(sha256Hex(`${left}${right}`));
    }

    level = nextLevel;
  }

  return level[0];
};

export const verifyMessageInTree = (messageHash, merkleRoot, proof = []) => {
  if (!messageHash || !merkleRoot || !Array.isArray(proof)) {
    return false;
  }

  let currentHash = normalizeHex(messageHash);

  for (const step of proof) {
    const siblingHash = normalizeHex(step?.hash);
    if (!siblingHash) {
      return false;
    }

    if (step?.position === "left") {
      currentHash = sha256Hex(`${siblingHash}${currentHash}`);
    } else if (step?.position === "right") {
      currentHash = sha256Hex(`${currentHash}${siblingHash}`);
    } else {
      return false;
    }
  }

  return currentHash === normalizeHex(merkleRoot);
};

export default {
  computeMessageHash,
  computeMerkleRoot,
  verifyMessageInTree,
};
