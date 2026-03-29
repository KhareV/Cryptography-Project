"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Coins,
  Loader2,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  LogOut,
  Save,
  Shield,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { uploadAPI, setAuthToken } from "@/lib/api";
import {
  createCommunityOnChain,
  findCommunityCreateTxHashOnChain,
} from "@/lib/communityContract";
import { useAuth } from "@clerk/nextjs";
import { useWallet } from "@/context/WalletContext";
import toast from "react-hot-toast";

export default function GroupInfoPanel({
  group,
  onOpenAddMembers,
  onRemoveMember,
  onLeaveGroup,
  onDeleteGroup,
  onUpdateGroup,
  onRegisterOnChain,
  currentUserId,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [avatar, setAvatar] = useState(group?.avatar || "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isActivatingPaidJoin, setIsActivatingPaidJoin] = useState(false);
  const avatarInputRef = useRef(null);
  const { getToken } = useAuth();
  const { address, isConnected, isCorrectNetwork } = useWallet();

  useEffect(() => {
    setName(group?.name || "");
    setDescription(group?.description || "");
    setAvatar(group?.avatar || "");
  }, [group?.name, group?.description, group?.avatar]);

  if (!group) {
    return null;
  }

  const isAdmin = Boolean(group.isAdmin);
  const memberCount = group.memberCount || group.members?.length || 0;
  const isPaidGroup = Number(group.joinFeeEth || 0) > 0;
  const isOnChainPending = isPaidGroup && !group.onChainRegistered;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }

    await onUpdateGroup?.({
      name: name.trim(),
      description: description.trim(),
      avatar: avatar.trim(),
    });
    setIsEditing(false);
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

  const handleActivatePaidJoin = async () => {
    if (!isOnChainPending || !isAdmin) return;

    if (!isConnected || !address) {
      toast.error("Connect your wallet to activate paid join");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error("Switch to Sepolia to activate paid join");
      return;
    }

    try {
      setIsActivatingPaidJoin(true);

      const { txHash } = await createCommunityOnChain({
        groupId: group.id,
        joinFeeEth: Number(group.joinFeeEth || 0),
      });

      await onRegisterOnChain?.(group.id, {
        txHash,
        walletAddress: address,
      });

      toast.success("Paid join is now active on-chain");
    } catch (error) {
      const reason = String(
        error?.reason || error?.shortMessage || error?.message || "",
      ).toLowerCase();

      if (reason.includes("community already exists")) {
        try {
          const existingTxHash = await findCommunityCreateTxHashOnChain({
            groupId: group.id,
            adminAddress: address,
          });

          if (!existingTxHash) {
            throw new Error(
              "Community exists on-chain but creation tx could not be found",
            );
          }

          await onRegisterOnChain?.(group.id, {
            txHash: existingTxHash,
            walletAddress: address,
          });

          toast.success("Recovered existing community and activated paid join");
        } catch (recoveryError) {
          toast.error(
            recoveryError.message ||
              "Community exists, but failed to sync on-chain registration",
          );
        }
      } else {
        toast.error(error.message || "Failed to activate paid join on-chain");
      }
    } finally {
      setIsActivatingPaidJoin(false);
    }
  };

  return (
    <aside className="w-full md:w-80 lg:w-[22rem] border-l border-border/70 bg-background/95 backdrop-blur overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border/70 bg-gradient-to-b from-background to-background-secondary/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Group Info
            </h3>
            <p className="text-sm text-foreground-secondary">
              {memberCount} members
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background-secondary/70 px-2.5 py-1 text-[11px] font-semibold text-foreground-secondary">
            <Shield className="w-3.5 h-3.5" />
            {isAdmin ? "Admin" : "Member"}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <section className="rounded-3xl border border-border/70 bg-background/90 shadow-sm p-4 space-y-4">
            <div className="flex justify-center">
              <Avatar
                src={avatar || group.avatar}
                name={group.name}
                size="2xl"
                className="ring-2 ring-background"
              />
            </div>

            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    leftIcon={
                      isUploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )
                    }
                  >
                    {isUploadingAvatar ? "Uploading..." : "Upload Group Icon"}
                  </Button>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>

                <Input
                  label="Icon URL"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  maxLength={1000}
                  placeholder="https://example.com/group-icon.png"
                />

                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={handleSave}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center space-y-1.5">
                  <p className="font-semibold text-foreground text-base">
                    {group.name}
                  </p>
                  <p className="text-sm text-foreground-secondary leading-relaxed">
                    {group.description || "No description"}
                  </p>
                </div>

                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={() => setIsEditing(true)}
                    leftIcon={<Pencil className="w-4 h-4" />}
                  >
                    Edit Group
                  </Button>
                )}
              </>
            )}
          </section>

          {isAdmin && (
            <section className="rounded-3xl border border-border/70 bg-background/90 shadow-sm p-3">
              <div className="space-y-2">
                <p className="text-xs text-foreground-secondary rounded-xl border border-border/70 bg-background p-3">
                  Admins can invite members directly for free using Add Members.
                </p>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full rounded-xl"
                  onClick={onOpenAddMembers}
                  leftIcon={<UserPlus className="w-4 h-4" />}
                >
                  Add Members
                </Button>

                {isPaidGroup && (
                  <div className="rounded-2xl border border-border/70 bg-background p-3 space-y-2">
                    <p className="text-xs text-foreground-secondary">
                      Join fee: {Number(group.joinFeeEth).toFixed(3)} ETH
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        group.onChainRegistered
                          ? "text-emerald-500"
                          : "text-amber-500"
                      }`}
                    >
                      {group.onChainRegistered
                        ? "On-chain active"
                        : "On-chain pending"}
                    </p>
                    {isOnChainPending && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full rounded-xl"
                        onClick={handleActivatePaidJoin}
                        disabled={isActivatingPaidJoin}
                        leftIcon={
                          isActivatingPaidJoin ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Coins className="w-4 h-4" />
                          )
                        }
                      >
                        {isActivatingPaidJoin
                          ? "Activating..."
                          : "Activate Paid Join"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-border/70 bg-background/90 shadow-sm p-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-[11px] uppercase tracking-wide text-foreground-secondary font-semibold">
                Members
              </p>
              <span className="text-xs text-foreground-secondary">
                {memberCount}
              </span>
            </div>

            <div className="space-y-2">
              {group.members?.map((member) => {
                const memberId = member.id || member._id;
                const isCurrentUser =
                  currentUserId && memberId === currentUserId;
                const canRemove = isAdmin && !isCurrentUser;

                return (
                  <div
                    key={memberId}
                    className="flex items-center gap-3 p-2.5 rounded-2xl border border-border/70 bg-background hover:bg-background-secondary/60 transition-colors"
                  >
                    <Avatar
                      src={member.avatar}
                      name={member.firstName || member.username}
                      size="sm"
                      showStatus
                      isOnline={member.isOnline}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.username}
                        {isCurrentUser ? " (You)" : ""}
                      </p>
                      <p className="text-xs text-foreground-secondary truncate">
                        @{member.username}
                      </p>
                    </div>

                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-red-500/10"
                        onClick={() => onRemoveMember?.(memberId)}
                        title="Remove member"
                      >
                        <UserMinus className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border/70 bg-background/90 space-y-2">
        <Button
          variant="secondary"
          className="w-full rounded-xl"
          onClick={onLeaveGroup}
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Leave Group
        </Button>

        {isAdmin && (
          <Button
            variant="danger"
            className="w-full rounded-xl"
            onClick={onDeleteGroup}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete Group
          </Button>
        )}
      </div>
    </aside>
  );
}
