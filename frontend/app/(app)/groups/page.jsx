"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useGroups } from "@/hooks/useGroups";
import { useWallet } from "@/context/WalletContext";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import GroupList from "@/components/groups/GroupList";
import CreateGroupModal from "@/components/groups/CreateGroupModal";
import JoinCommunityModal from "@/components/groups/JoinCommunityModal";
import Sidebar from "@/components/chat/Sidebar";
import { joinCommunityOnChain } from "@/lib/communityContract";
import toast from "react-hot-toast";

export default function GroupsPage() {
  const { groupUnreadCounts, setMobileView, isMobileView, activeGroupId } =
    useStore();
  const {
    groups,
    isLoading,
    isSaving,
    discoverResults,
    isDiscoverLoading,
    discoverGroups,
    createGroup,
    joinGroup,
    setActiveGroup,
  } = useGroups();
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const router = useRouter();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [joinTarget, setJoinTarget] = useState(null);
  const [isJoiningPaid, setIsJoiningPaid] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleResize = () => {
      setMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setMobileView]);

  useEffect(() => {
    setActiveGroup(null);
  }, [setActiveGroup]);

  const filtered = groups.filter((group) => {
    if (!query.trim()) return true;
    const lower = query.toLowerCase();
    return (
      group.name?.toLowerCase().includes(lower) ||
      group.description?.toLowerCase().includes(lower)
    );
  });

  const discovered = (discoverResults || []).filter(
    (group) => !groups.some((mine) => mine.id === group.id),
  );

  const handleJoinGroup = async (group) => {
    if (!group?.id) return;

    const fee = Number(group.joinFeeEth || 0);
    if (fee <= 0) {
      toast.error("This group has no valid join fee configured yet.");
      return;
    }

    if (!group.onChainRegistered) {
      toast.error("Paid join is not active for this group yet.");
      return;
    }

    setJoinTarget(group);
  };

  const handlePaidJoin = async () => {
    if (!joinTarget?.id) return;

    if (!isConnected || !address) {
      toast.error("Connect your wallet before joining this community.");
      return;
    }

    if (!isCorrectNetwork) {
      toast.error("Switch to Sepolia to join this paid community.");
      return;
    }

    try {
      setIsJoiningPaid(true);
      const fee = Number(joinTarget.joinFeeEth || 0);
      const { txHash } = await joinCommunityOnChain({
        groupId: joinTarget.id,
        joinFeeEth: fee,
      });

      const joined = await joinGroup(joinTarget.id, {
        walletAddress: address,
        joinTxHash: txHash,
      });

      setJoinTarget(null);

      if (joined?.id) {
        router.push(`/groups/${joined.id}`);
      }
    } catch (error) {
      toast.error(error.message || "Failed to complete paid join.");
    } finally {
      setIsJoiningPaid(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {!isMobileView && <Sidebar />}

      {isMobileView ? (
        <aside className="w-full h-full border-r border-border/70 bg-background flex flex-col">
          <div className="p-4 border-b border-border/70 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-foreground">Groups</h1>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsCreateOpen(true)}
              >
                New Group
              </Button>
            </div>

            <SearchInput
              placeholder="Search groups"
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                discoverGroups(value);
              }}
              onClear={() => setQuery("")}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <GroupList
              groups={filtered}
              activeGroupId={activeGroupId}
              unreadMap={groupUnreadCounts}
              isLoading={isLoading}
            />
          </div>

          {query.trim() && (
            <div className="border-t border-border/70 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-secondary px-1">
                Discover
              </p>

              {isDiscoverLoading ? (
                <p className="text-sm text-foreground-secondary px-1">
                  Searching communities...
                </p>
              ) : discovered.length === 0 ? (
                <p className="text-sm text-foreground-secondary px-1">
                  No discoverable groups for this query.
                </p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {discovered.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-xl border border-border/70 bg-background/80 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {group.name}
                          </p>
                          <p className="text-xs text-foreground-secondary">
                            {group.memberCount || 0} members
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleJoinGroup(group)}
                          disabled={
                            Number(group.joinFeeEth || 0) <= 0 ||
                            !group.onChainRegistered
                          }
                        >
                          {Number(group.joinFeeEth || 0) > 0
                            ? `${Number(group.joinFeeEth).toFixed(3)} ETH`
                            : "Unavailable"}
                        </Button>
                      </div>
                      {Number(group.joinFeeEth || 0) > 0 &&
                        !group.onChainRegistered && (
                          <p className="mt-2 text-[11px] text-amber-500">
                            Paid join is not active yet. Waiting for admin
                            on-chain registration.
                          </p>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      ) : (
        <main className="flex-1 flex items-center justify-center bg-background/60 chat-surface">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center px-6 rounded-3xl border border-border/70 bg-background/90 backdrop-blur py-10 max-w-2xl mx-6 shadow-lg"
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/25">
              <Users className="w-9 h-9 text-foreground-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Select a group from the sidebar
            </h2>
            <p className="text-sm text-foreground-secondary max-w-sm mb-5">
              Use the left sidebar toggle to switch views. In Groups mode, only
              groups are listed.
            </p>

            <div className="mb-5">
              <SearchInput
                placeholder="Discover public groups"
                value={query}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuery(value);
                  discoverGroups(value);
                }}
                onClear={() => {
                  setQuery("");
                }}
              />
            </div>

            {query.trim() && (
              <div className="mb-5 text-left space-y-2 max-h-56 overflow-y-auto pr-1">
                {isDiscoverLoading ? (
                  <p className="text-sm text-foreground-secondary">
                    Searching communities...
                  </p>
                ) : discovered.length === 0 ? (
                  <p className="text-sm text-foreground-secondary">
                    No discoverable groups for this query.
                  </p>
                ) : (
                  discovered.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-xl border border-border/70 bg-background/80 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {group.name}
                          </p>
                          <p className="text-xs text-foreground-secondary">
                            {group.memberCount || 0} members
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleJoinGroup(group)}
                          disabled={
                            Number(group.joinFeeEth || 0) <= 0 ||
                            !group.onChainRegistered
                          }
                        >
                          {Number(group.joinFeeEth || 0) > 0
                            ? `${Number(group.joinFeeEth).toFixed(3)} ETH`
                            : "Unavailable"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateOpen(true)}
            >
              Create New Group
            </Button>
          </motion.div>
        </main>
      )}

      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={createGroup}
        isSaving={isSaving}
      />

      <JoinCommunityModal
        isOpen={Boolean(joinTarget)}
        onClose={() => setJoinTarget(null)}
        group={joinTarget}
        isJoining={isJoiningPaid}
        onJoin={handlePaidJoin}
      />
    </div>
  );
}
