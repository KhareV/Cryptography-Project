"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useStore } from "@/store/useStore";
import { groupAPI, setAuthToken } from "@/lib/api";
import toast from "react-hot-toast";

export function useGroups() {
  const { getToken } = useAuth();
  const {
    groups,
    activeGroupId,
    setGroups,
    addGroup,
    updateGroup,
    removeGroup,
    setActiveGroup,
    clearGroupUnread,
  } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [discoverResults, setDiscoverResults] = useState([]);
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const withAuth = useCallback(
    async (fn) => {
      const token = await getToken();
      setAuthToken(token);
      return fn();
    },
    [getToken],
  );

  const fetchGroups = useCallback(
    async (force = false) => {
      if (hasFetched && !force) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await withAuth(() => groupAPI.getMyGroups());
        setGroups(response.data || []);
        setHasFetched(true);
      } catch (error) {
        toast.error(error.message || "Failed to load groups");
      } finally {
        setIsLoading(false);
      }
    },
    [hasFetched, setGroups, withAuth],
  );

  const discoverGroups = useCallback(
    async (query) => {
      try {
        setIsDiscoverLoading(true);
        const response = await withAuth(() =>
          groupAPI.discover(query || "", 30),
        );
        setDiscoverResults(response.data?.groups || []);
      } catch (error) {
        toast.error(error.message || "Failed to discover groups");
      } finally {
        setIsDiscoverLoading(false);
      }
    },
    [withAuth],
  );

  const createGroup = useCallback(
    async (payload) => {
      try {
        setIsSaving(true);
        const response = await withAuth(() => groupAPI.create(payload));
        const group = response.data?.group;

        if (group) {
          addGroup(group);
          setActiveGroup(group.id);
          clearGroupUnread(group.id);
          toast.success("Group created");
        }

        return group;
      } catch (error) {
        toast.error(error.message || "Failed to create group");
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [withAuth, addGroup, setActiveGroup, clearGroupUnread],
  );

  const getGroup = useCallback(
    async (groupId) => {
      const response = await withAuth(() => groupAPI.getOne(groupId));
      const group = response.data?.group;
      if (group) {
        updateGroup(group.id, group);
      }
      return group;
    },
    [withAuth, updateGroup],
  );

  const addMember = useCallback(
    async (groupId, memberId) => {
      const response = await withAuth(() =>
        groupAPI.addMember(groupId, memberId),
      );
      const group = response.data?.group;
      if (group) {
        updateGroup(groupId, group);
      }
      toast.success("Member added");
      return group;
    },
    [withAuth, updateGroup],
  );

  const removeMember = useCallback(
    async (groupId, memberId) => {
      const response = await withAuth(() =>
        groupAPI.removeMember(groupId, memberId),
      );
      const group = response.data?.group;
      if (group) {
        updateGroup(groupId, group);
      }
      toast.success("Member removed");
      return group;
    },
    [withAuth, updateGroup],
  );

  const updateGroupDetails = useCallback(
    async (groupId, payload) => {
      const response = await withAuth(() => groupAPI.update(groupId, payload));
      const group = response.data?.group;
      if (group) {
        updateGroup(groupId, group);
      }
      toast.success("Group updated");
      return group;
    },
    [withAuth, updateGroup],
  );

  const registerGroupOnChain = useCallback(
    async (groupId, payload) => {
      const response = await withAuth(() =>
        groupAPI.registerOnChain(groupId, payload),
      );
      const group = response.data?.group;
      if (group) {
        updateGroup(groupId, group);
      }
      toast.success("Group registered on-chain");
      return group;
    },
    [withAuth, updateGroup],
  );

  const joinGroup = useCallback(
    async (groupId, payload = {}) => {
      const response = await withAuth(() => groupAPI.join(groupId, payload));
      const group = response.data?.group;

      if (group) {
        addGroup(group);
        setActiveGroup(group.id);
        clearGroupUnread(group.id);
      }

      toast.success("Joined group");
      return group;
    },
    [withAuth, addGroup, setActiveGroup, clearGroupUnread],
  );

  const leaveGroup = useCallback(
    async (groupId) => {
      await withAuth(() => groupAPI.leave(groupId));
      removeGroup(groupId);
      toast.success("Left group");
    },
    [withAuth, removeGroup],
  );

  const deleteGroup = useCallback(
    async (groupId) => {
      await withAuth(() => groupAPI.delete(groupId));
      removeGroup(groupId);
      toast.success("Group deleted");
    },
    [withAuth, removeGroup],
  );

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return {
    groups,
    activeGroupId,
    isLoading,
    isSaving,
    discoverResults,
    isDiscoverLoading,
    fetchGroups,
    discoverGroups,
    createGroup,
    getGroup,
    addMember,
    removeMember,
    updateGroupDetails,
    registerGroupOnChain,
    joinGroup,
    leaveGroup,
    deleteGroup,
    setActiveGroup,
  };
}

export default useGroups;
