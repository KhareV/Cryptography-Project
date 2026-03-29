"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, X } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { uploadAPI, setAuthToken } from "@/lib/api";
import { createCommunityOnChain } from "@/lib/communityContract";
import { useAuth } from "@clerk/nextjs";
import { useWallet } from "@/context/WalletContext";
import toast from "react-hot-toast";

const generateObjectId = () => {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  return Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
};

export default function CreateGroupModal({
  isOpen,
  onClose,
  onCreate,
  isSaving,
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { address, isConnected, isCorrectNetwork } = useWallet();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("");
  const [joinFeeEth, setJoinFeeEth] = useState("0.001");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCreatingOnChain, setIsCreatingOnChain] = useState(false);
  const avatarInputRef = useRef(null);

  const resetState = () => {
    setName("");
    setDescription("");
    setAvatar("");
    setJoinFeeEth("0.001");
    setIsUploadingAvatar(false);
    setIsCreatingOnChain(false);
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const token = await getToken();
      setAuthToken(token);

      const response = await uploadAPI.uploadFile(file);
      const fileUrl = response.data?.fileUrl;
      const fileType = response.data?.type;

      if (!fileUrl || fileType !== "image") {
        throw new Error("Failed to upload group icon");
      }

      setAvatar(fileUrl);
      toast.success("Group icon uploaded");
    } catch (error) {
      toast.error(error.message || "Failed to upload group icon");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }

    if (!isConnected || !address) {
      toast.error("Connect your MetaMask wallet before creating a group.");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error("Switch MetaMask to Sepolia before creating a group.");
      return;
    }

    const parsedJoinFee = Number(joinFeeEth);
    if (!Number.isFinite(parsedJoinFee) || parsedJoinFee <= 0) {
      toast.error("Join fee must be greater than 0 ETH.");
      return;
    }

    try {
      setIsCreatingOnChain(true);

      const groupId = generateObjectId();
      const { txHash } = await createCommunityOnChain({
        groupId,
        joinFeeEth: parsedJoinFee,
      });

      const group = await onCreate({
        groupId,
        name: name.trim(),
        description: description.trim(),
        avatar: avatar.trim(),
        joinFeeEth: parsedJoinFee,
        walletAddress: address,
        createTxHash: txHash,
      });

      resetState();
      onClose();

      if (group?.id) {
        router.push(`/groups/${group.id}`);
      }
    } catch (error) {
      toast.error(
        error.message || "Failed to create group with on-chain payment.",
      );
    } finally {
      setIsCreatingOnChain(false);
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Group"
      description="Choose a name and add members"
      size="lg"
      className="bg-background"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-background-secondary/40">
          <Avatar src={avatar} name={name || "Group"} size="xl" />

          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-medium text-foreground">Group icon</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                leftIcon={<Camera className="w-4 h-4" />}
              >
                {isUploadingAvatar ? "Uploading..." : "Upload Icon"}
              </Button>

              {avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatar("")}
                  leftIcon={<X className="w-4 h-4" />}
                >
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
        </div>

        <Input
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Weekend Trip"
          maxLength={100}
        />

        <Input
          label="Icon URL (optional)"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="https://example.com/group-icon.png"
          maxLength={1000}
        />

        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional group description"
          maxLength={500}
        />

        <Input
          label="Join fee (ETH)"
          type="number"
          value={joinFeeEth}
          onChange={(e) => setJoinFeeEth(e.target.value)}
          min="0.000001"
          step="0.000001"
          placeholder="0.001"
        />

        <p className="text-xs text-foreground-secondary rounded-xl border border-border/70 p-3 bg-background-secondary/65">
          Creating a group now requires a MetaMask transaction, and members must
          join later through paid on-chain join.
        </p>

        <ModalFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={isSaving || isCreatingOnChain || isUploadingAvatar}
          >
            {isSaving || isCreatingOnChain
              ? "Processing Payment..."
              : "Pay & Create Group"}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
