"use client";

import { useState, useCallback } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { userAPI, setAuthToken } from "@/lib/api";
import { debounce } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import toast from "react-hot-toast";

export default function AddMembersModal({
  isOpen,
  onClose,
  existingMembers,
  onAddMembers,
}) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingIds = new Set(
    (existingMembers || []).map((member) => member.id || member._id),
  );

  const searchUsers = useCallback(
    debounce(async (value) => {
      if (!value.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        const token = await getToken();
        setAuthToken(token);
        const response = await userAPI.searchUsers(value.trim());
        const users = response.data?.users || [];
        setResults(
          users.filter((user) => !existingIds.has(user.id || user._id)),
        );
      } catch (error) {
        toast.error("Failed to search users");
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [getToken, existingIds],
  );

  const toggleUser = (user) => {
    const userId = user.id || user._id;
    if (!userId) return;

    setSelected((prev) => {
      const exists = prev.some((item) => (item.id || item._id) === userId);
      if (exists) {
        return prev.filter((item) => (item.id || item._id) !== userId);
      }
      return [...prev, user];
    });
  };

  const handleSubmit = async () => {
    if (!selected.length) {
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddMembers(selected.map((user) => user.id || user._id));
      setSelected([]);
      setResults([]);
      setQuery("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedIds = new Set(selected.map((item) => item.id || item._id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Members"
      description="Search and add people to this group"
      size="md"
    >
      <div className="space-y-4">
        <SearchInput
          placeholder="Search users"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            searchUsers(value);
          }}
          onClear={() => {
            setQuery("");
            setResults([]);
          }}
        />

        <div className="border border-border rounded-xl overflow-hidden">
          <ScrollArea className="max-h-60">
            {isSearching ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            ) : results.length > 0 ? (
              <div className="p-2 space-y-1">
                {results.map((user) => {
                  const userId = user.id || user._id;
                  const isSelected = selectedIds.has(userId);

                  return (
                    <button
                      key={userId}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-accent/15 border border-accent/30"
                          : "hover:bg-background-secondary border border-transparent"
                      }`}
                      onClick={() => toggleUser(user)}
                    >
                      <Avatar
                        src={user.avatar}
                        name={user.username}
                        size="sm"
                      />
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.username}
                        </p>
                        <p className="text-xs text-foreground-secondary truncate">
                          @{user.username}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-semibold text-accent">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-foreground-secondary">
                <UserPlus className="w-6 h-6 mx-auto mb-2 opacity-50" />
                {query.trim() ? "No matching users" : "Search to find members"}
              </div>
            )}
          </ScrollArea>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting
              ? "Adding..."
              : `Add ${selected.length || ""} Member${selected.length === 1 ? "" : "s"}`}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
