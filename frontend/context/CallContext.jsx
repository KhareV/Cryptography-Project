"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getSocket } from "@/lib/socket";
import { useStore } from "@/store/useStore";

const CallContext = createContext(null);

const STUN_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

const formatDuration = (seconds = 0) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const getDisplayName = (user) => {
  if (!user) return "Unknown";
  return (
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.username ||
    "Unknown"
  );
};

const getUserId = (userLike) => {
  if (!userLike) return "";
  return (
    userLike.id?.toString?.() ||
    userLike._id?.toString?.() ||
    userLike.userId?.toString?.() ||
    ""
  );
};

export function CallProvider({ children }) {
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isCallScreenOpen, setCallScreenOpen] = useState(false);
  const [showMicAccessModal, setShowMicAccessModal] = useState(false);

  const { user, isSocketConnected } = useStore();

  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const remoteAudioRef = useRef(null);

  const syncActiveCallRef = useCallback((nextValue) => {
    activeCallRef.current = nextValue;
    setActiveCall(nextValue);
  }, []);

  const syncIncomingCallRef = useCallback((nextValue) => {
    incomingCallRef.current = nextValue;
    setIncomingCall(nextValue);
  }, []);

  const cleanupMedia = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    pendingIceCandidatesRef.current = [];

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    setIsMuted(false);
    setIsSpeakerOn(false);
  }, []);

  const closeWithEndedState = useCallback(
    (message, duration) => {
      const current = activeCallRef.current;
      const endedAt = new Date().toISOString();
      if (current) {
        syncActiveCallRef({
          ...current,
          status: "ended",
          endedAt,
        });
      }

      setCallScreenOpen(false);

      window.setTimeout(() => {
        syncActiveCallRef(null);
      }, 900);

      if (message) {
        if (typeof duration === "number" && duration > 0) {
          toast(`${message} (${formatDuration(duration)})`);
        } else {
          toast(message);
        }
      }
    },
    [syncActiveCallRef],
  );

  const requestMicrophone = useCallback(async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (error) {
      setShowMicAccessModal(true);
      throw error;
    }
  }, []);

  const emitWithOptionalAck = useCallback((event, payload, callback) => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      callback?.({ success: false, error: "Socket not connected" });
      return;
    }
    socket.emit(event, payload, callback);
  }, []);

  const createPeerConnection = useCallback((callId, peerId) => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const connection = new RTCPeerConnection(STUN_CONFIG);

    connection.onicecandidate = (event) => {
      if (!event.candidate) return;
      emitWithOptionalAck("call:ice-candidate", {
        callId,
        to: peerId,
        candidate: event.candidate,
      });
    };

    connection.ontrack = async (event) => {
      const [stream] = event.streams;
      if (!stream) return;

      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }

      remoteAudioRef.current.srcObject = stream;
      try {
        await remoteAudioRef.current.play();
      } catch {
        // Autoplay can be blocked on some browsers; audio will play after first interaction.
      }
    };

    connection.oniceconnectionstatechange = () => {
      if (connection.iceConnectionState === "failed") {
        toast.error("Could not connect, check your internet");
        endCall({ silent: true, notify: true });
      }
    };

    peerConnectionRef.current = connection;
    return connection;
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    const connection = peerConnectionRef.current;
    if (!connection || !connection.remoteDescription) return;

    const candidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale ICE candidates.
      }
    }
  }, []);

  const initiateCall = useCallback(
    async (userId, userName, userAvatar) => {
      if (!isSocketConnected) {
        toast.error("Socket is not connected");
        return;
      }

      if (activeCallRef.current || incomingCallRef.current) {
        toast.error("You are already in a call");
        return;
      }

      const peerId = userId?.toString();
      if (!peerId) {
        toast.error("Invalid user");
        return;
      }

      const callId = crypto?.randomUUID
        ? crypto.randomUUID()
        : `call-${Date.now()}`;

      try {
        const localStream = await requestMicrophone();
        localStreamRef.current = localStream;

        const peerConnection = createPeerConnection(callId, peerId);
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        const currentUserName = getDisplayName(user);

        syncActiveCallRef({
          callId,
          peerId,
          peerName: userName || "Unknown",
          peerAvatar: userAvatar || "",
          status: "ringing",
          startedAt: null,
        });
        setCallScreenOpen(true);

        emitWithOptionalAck(
          "call:initiate",
          {
            to: peerId,
            callId,
            callerName: currentUserName,
            callerAvatar: user?.avatar || "",
          },
          (response) => {
            if (!response?.success) {
              cleanupMedia();
              syncActiveCallRef(null);
              setCallScreenOpen(false);

              if (response?.reason === "busy") {
                toast.error("User is currently in a call");
                return;
              }

              toast.error(response?.error || "Failed to start call");
            }
          },
        );
      } catch {
        cleanupMedia();
        syncActiveCallRef(null);
        setCallScreenOpen(false);
      }
    },
    [
      cleanupMedia,
      createPeerConnection,
      emitWithOptionalAck,
      isSocketConnected,
      requestMicrophone,
      syncActiveCallRef,
      user,
    ],
  );

  const acceptCall = useCallback(async () => {
    const call = incomingCallRef.current;
    if (!call) return;

    try {
      const localStream = await requestMicrophone();
      localStreamRef.current = localStream;

      const peerConnection = createPeerConnection(call.callId, call.callerId);
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      syncIncomingCallRef(null);
      syncActiveCallRef({
        callId: call.callId,
        peerId: call.callerId,
        peerName: call.callerName,
        peerAvatar: call.callerAvatar,
        status: "ringing",
        startedAt: null,
      });
      setCallScreenOpen(true);

      emitWithOptionalAck(
        "call:accept",
        { callId: call.callId, to: call.callerId },
        (response) => {
          if (!response?.success) {
            cleanupMedia();
            syncActiveCallRef(null);
            setCallScreenOpen(false);
            toast.error(response?.error || "Failed to accept call");
          }
        },
      );
    } catch {
      cleanupMedia();
      syncIncomingCallRef(null);
      syncActiveCallRef(null);
      setCallScreenOpen(false);
    }
  }, [
    cleanupMedia,
    createPeerConnection,
    emitWithOptionalAck,
    requestMicrophone,
    syncActiveCallRef,
    syncIncomingCallRef,
  ]);

  const rejectCall = useCallback(
    ({ reason = "declined", missed = false } = {}) => {
      const call = incomingCallRef.current;
      if (!call) return;

      emitWithOptionalAck("call:reject", {
        callId: call.callId,
        to: call.callerId,
        reason,
        missed,
      });

      syncIncomingCallRef(null);

      if (missed) {
        toast("Missed call");
      } else if (reason === "busy") {
        toast("You are already in another call");
      } else {
        toast("Call declined");
      }
    },
    [emitWithOptionalAck, syncIncomingCallRef],
  );

  const endCall = useCallback(
    ({ silent = false, notify = true } = {}) => {
      const current = activeCallRef.current;
      if (!current) return;

      if (notify) {
        emitWithOptionalAck("call:end", {
          callId: current.callId,
          to: current.peerId,
        });
      }

      cleanupMedia();

      if (silent) {
        syncActiveCallRef(null);
        setCallScreenOpen(false);
      } else {
        closeWithEndedState("Call ended");
      }
    },
    [cleanupMedia, closeWithEndedState, emitWithOptionalAck, syncActiveCallRef],
  );

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const track = stream.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  const toggleSpeaker = useCallback(async () => {
    setIsSpeakerOn((prev) => !prev);

    if (!remoteAudioRef.current) return;

    if (typeof remoteAudioRef.current.setSinkId === "function") {
      try {
        await remoteAudioRef.current.setSinkId("default");
      } catch {
        // setSinkId is not supported on all browsers.
      }
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !isSocketConnected) return;

    const handleIncoming = (payload) => {
      const callerId =
        payload?.callerId?.toString?.() || payload?.from?.toString?.();
      if (!callerId || !payload?.callId) return;

      if (activeCallRef.current || incomingCallRef.current) {
        emitWithOptionalAck("call:reject", {
          callId: payload.callId,
          to: callerId,
          reason: "busy",
        });
        return;
      }

      syncIncomingCallRef({
        callId: payload.callId,
        callerId,
        callerName: payload.callerName || "Unknown",
        callerAvatar: payload.callerAvatar || "",
      });
    };

    const handleAccepted = async (payload) => {
      const current = activeCallRef.current;
      if (!current || current.callId !== payload?.callId) return;

      const peerConnection = createPeerConnection(
        current.callId,
        current.peerId,
      );

      try {
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });

        await peerConnection.setLocalDescription(offer);

        emitWithOptionalAck("call:offer", {
          callId: current.callId,
          to: current.peerId,
          offer,
        });
      } catch {
        cleanupMedia();
        syncActiveCallRef(null);
        setCallScreenOpen(false);
        toast.error("Failed to start peer connection");
      }
    };

    const handleOffer = async (payload) => {
      const current = activeCallRef.current;
      if (!current || current.callId !== payload?.callId) return;

      const peerConnection = createPeerConnection(
        current.callId,
        current.peerId,
      );

      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(payload.offer),
        );

        await flushPendingIceCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        emitWithOptionalAck("call:answer", {
          callId: current.callId,
          to: current.peerId,
          answer,
        });

        syncActiveCallRef({
          ...current,
          status: "active",
          startedAt: current.startedAt || new Date().toISOString(),
        });
      } catch {
        cleanupMedia();
        syncActiveCallRef(null);
        setCallScreenOpen(false);
        toast.error("Failed to answer call");
      }
    };

    const handleAnswer = async (payload) => {
      const current = activeCallRef.current;
      if (!current || current.callId !== payload?.callId) return;

      if (!peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer),
        );

        await flushPendingIceCandidates();

        syncActiveCallRef({
          ...current,
          status: "active",
          startedAt: current.startedAt || new Date().toISOString(),
        });
      } catch {
        cleanupMedia();
        syncActiveCallRef(null);
        setCallScreenOpen(false);
        toast.error("Failed to connect call");
      }
    };

    const handleIceCandidate = async (payload) => {
      const current = activeCallRef.current;
      if (
        !current ||
        current.callId !== payload?.callId ||
        !payload?.candidate
      ) {
        return;
      }

      if (
        !peerConnectionRef.current ||
        !peerConnectionRef.current.remoteDescription
      ) {
        pendingIceCandidatesRef.current.push(payload.candidate);
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(payload.candidate),
        );
      } catch {
        // Ignore invalid ICE candidates.
      }
    };

    const handleEnded = (payload) => {
      const current = activeCallRef.current;
      if (!current || current.callId !== payload?.callId) return;

      cleanupMedia();

      if (payload?.dropped) {
        closeWithEndedState("Call dropped", payload?.duration);
      } else {
        closeWithEndedState("Call ended", payload?.duration);
      }
    };

    const handleRejected = (payload) => {
      const current = activeCallRef.current;
      if (!current || current.callId !== payload?.callId) return;

      cleanupMedia();
      syncActiveCallRef(null);
      setCallScreenOpen(false);

      if (payload?.reason === "busy") {
        toast.error("User is currently in another call");
      } else {
        toast("Call declined");
      }
    };

    const handleUserOffline = (payload) => {
      const current = activeCallRef.current;
      if (!current) return;

      if (payload?.userId?.toString?.() === current.peerId?.toString?.()) {
        cleanupMedia();
        closeWithEndedState("Call dropped");
      }
    };

    const handleUserOfflineDuringInitiate = (payload) => {
      const current = activeCallRef.current;
      if (!current || current.callId !== payload?.callId) return;

      cleanupMedia();
      syncActiveCallRef(null);
      setCallScreenOpen(false);
      toast.error("User is offline");
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:ended", handleEnded);
    socket.on("call:rejected", handleRejected);
    socket.on("call:user-offline", handleUserOfflineDuringInitiate);
    socket.on("user:offline", handleUserOffline);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:ended", handleEnded);
      socket.off("call:rejected", handleRejected);
      socket.off("call:user-offline", handleUserOfflineDuringInitiate);
      socket.off("user:offline", handleUserOffline);
    };
  }, [
    cleanupMedia,
    closeWithEndedState,
    createPeerConnection,
    emitWithOptionalAck,
    flushPendingIceCandidates,
    isSocketConnected,
    syncActiveCallRef,
    syncIncomingCallRef,
  ]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  const contextValue = useMemo(
    () => ({
      activeCall,
      incomingCall,
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      isMuted,
      toggleMute,
      isSpeakerOn,
      toggleSpeaker,
      isCallScreenOpen,
      setCallScreenOpen,
    }),
    [
      acceptCall,
      activeCall,
      endCall,
      incomingCall,
      initiateCall,
      isCallScreenOpen,
      isMuted,
      isSpeakerOn,
      rejectCall,
      toggleMute,
      toggleSpeaker,
    ],
  );

  return (
    <CallContext.Provider value={contextValue}>
      {children}

      <Modal
        isOpen={showMicAccessModal}
        onClose={() => setShowMicAccessModal(false)}
        title="Microphone access required"
        description="Microphone access is required for calls. Enable it in your browser settings and try again."
        showCloseButton={false}
      >
        <p className="text-sm text-foreground-secondary">
          CryptoChat only requests audio input and never enables video for
          calls.
        </p>
        <ModalFooter>
          <Button onClick={() => setShowMicAccessModal(false)}>Got it</Button>
        </ModalFooter>
      </Modal>
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used inside a CallProvider");
  }
  return context;
}

export default CallContext;
