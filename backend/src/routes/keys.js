import { Router } from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAuthentication } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { validateUserId } from "../middleware/validators.js";
import { ApiError, sendSuccess } from "../utils/helpers.js";
import User from "../models/User.js";
import {
  getOnChainKeyStatus,
  verifyKeyRegistrationTx,
} from "../utils/blockchainVerify.js";

const router = Router();

router.use(clerkMiddleware());

/**
 * POST /api/keys/register
 * Verify and persist on-chain key registration proof.
 */
router.post(
  "/register",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const {
      publicKey,
      fingerprint,
      walletAddress,
      txHash,
      encryptedPrivateKey,
      keyEncryptionSalt,
      keyEncryptionIv,
      keyEncryptionIterations,
      keyEncryptionAlgorithm,
      keyEncryptionKdf,
    } = req.body || {};

    if (
      !publicKey ||
      !fingerprint ||
      !walletAddress ||
      !txHash ||
      !encryptedPrivateKey ||
      !keyEncryptionSalt ||
      !keyEncryptionIv
    ) {
      throw new ApiError(
        400,
        "publicKey, fingerprint, walletAddress, txHash and encrypted private key envelope are required",
      );
    }

    const userId = req.userId.toString();

    await verifyKeyRegistrationTx({
      txHash,
      userId,
      walletAddress,
      publicKey,
      fingerprint,
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          walletAddress: walletAddress.toLowerCase(),
          blockchainTxHash: txHash,
          keyFingerprint: fingerprint,
          keyPublicKey: publicKey,
          encryptedPrivateKey,
          keyEncryptionSalt,
          keyEncryptionIv,
          keyEncryptionIterations: Number(keyEncryptionIterations) || 100000,
          keyEncryptionAlgorithm: keyEncryptionAlgorithm || "AES-256-GCM",
          keyEncryptionKdf: keyEncryptionKdf || "PBKDF2-SHA-256",
          keyRegisteredAt: new Date(),
        },
      },
      { new: true },
    ).lean();

    sendSuccess(res, 200, "Key registration verified on-chain", {
      user: {
        id: updatedUser._id,
        walletAddress: updatedUser.walletAddress,
        blockchainTxHash: updatedUser.blockchainTxHash,
        keyFingerprint: updatedUser.keyFingerprint,
      },
    });
  }),
);

const buildStatusPayload = async (user, options = {}) => {
  const { includeLocalKeyStorage = false } = options;
  const chainStatus = await getOnChainKeyStatus(user._id.toString());

  const walletMatches =
    !user.walletAddress ||
    (chainStatus.registeredBy || "").toLowerCase() ===
      user.walletAddress.toLowerCase();

  const verified =
    Boolean(chainStatus.registered) && !Boolean(chainStatus.revoked);

  const payload = {
    userId: user._id.toString(),
    walletAddress: user.walletAddress || "",
    verified,
    walletMatches,
    onChain: {
      registered: Boolean(chainStatus.registered),
      revoked: Boolean(chainStatus.revoked),
      fingerprint: chainStatus.fingerprint || "",
      publicKey: chainStatus.publicKey || "",
      registeredAt: chainStatus.registeredAt || 0,
      registeredBy: chainStatus.registeredBy || "",
    },
  };

  if (includeLocalKeyStorage) {
    payload.localKeyStorage = {
      encryptedPrivateKey: user.encryptedPrivateKey || "",
      keyEncryptionSalt: user.keyEncryptionSalt || "",
      keyEncryptionIv: user.keyEncryptionIv || "",
      keyEncryptionIterations: user.keyEncryptionIterations || 100000,
      keyEncryptionAlgorithm: user.keyEncryptionAlgorithm || "AES-256-GCM",
      keyEncryptionKdf: user.keyEncryptionKdf || "PBKDF2-SHA-256",
    };
  }

  return payload;
};

/**
 * GET /api/keys/status/me
 * Check own blockchain key status.
 */
router.get(
  "/status/me",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId).select(
      "walletAddress keyFingerprint keyPublicKey encryptedPrivateKey keyEncryptionSalt keyEncryptionIv keyEncryptionIterations keyEncryptionAlgorithm keyEncryptionKdf isActive",
    );

    if (!user || !user.isActive) {
      throw new ApiError(404, "User not found");
    }

    const status = await buildStatusPayload(user, {
      includeLocalKeyStorage: true,
    });
    sendSuccess(res, 200, "Key status retrieved", { status });
  }),
);

/**
 * GET /api/keys/status/:userId
 * Check target user's blockchain key status.
 */
router.get(
  "/status/:userId",
  requireAuthentication,
  validateUserId,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId).select(
      "walletAddress keyFingerprint keyPublicKey isActive",
    );

    if (!user || !user.isActive) {
      throw new ApiError(404, "User not found");
    }

    const status = await buildStatusPayload(user);
    sendSuccess(res, 200, "Key status retrieved", { status });
  }),
);

export default router;
