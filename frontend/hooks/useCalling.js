"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import {
  initiateCall,
  answerCall,
  declineCall,
  endCall,
  sendIceCandidate,
  sendRtcOffer,
  sendRtcAnswer,
} from "@/lib/socket";
import { playRingtone, stopRingtone } from "@/lib/utils";
import toast from "react-hot-toast";

export function useCalling() {
  const [activeCall, setActiveCall] = useState(null);
  const [isCallModalOpen, setCallModalOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("idle"); // idle, calling, ringing, connected, ended
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const peerConnectionRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  const { user, isSocketConnected } = useStore();

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
    iceCandidatePoolSize: 10,
  };

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && activeCall) {
        console.log("Sending ICE candidate:", event.candidate);
        sendIceCandidate({
          callId: activeCall.callId,
          candidate: event.candidate,
          to:
            activeCall.caller.id === user?.id
              ? activeCall.recipient.id
              : activeCall.caller.id,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log("Received remote stream:", event.streams[0]);
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", peerConnection.connectionState);
      if (peerConnection.connectionState === "connected") {
        setCallStatus("connected");
        stopRingtone();
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
      } else if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "disconnected"
      ) {
        console.log("WebRTC connection failed/disconnected");
        // Call handleCallEnd directly without dependency
        setTimeout(() => {
          setActiveCall(null);
          setCallModalOpen(false);
          setCallStatus("idle");
          stopRingtone();
        }, 0);
      } else if (peerConnection.connectionState === "connecting") {
        // Set a timeout for connection
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        connectionTimeoutRef.current = setTimeout(() => {
          console.log("WebRTC connection timeout");
          toast.error("Connection timeout");
          // Call handleCallEnd directly without dependency
          setTimeout(() => {
            setActiveCall(null);
            setCallModalOpen(false);
            setCallStatus("idle");
            stopRingtone();
          }, 0);
        }, 15000); // 15 second timeout
      }
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", peerConnection.iceGatheringState);
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peerConnection.iceConnectionState);
    };

    return peerConnection;
  }, [activeCall, user]);

  // Get user media
  const getUserMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false, // Voice calls only
      });
      setLocalStream(stream);
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }
      return stream;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Failed to access microphone");
      throw error;
    }
  }, []);

  // Start a call
  const startCall = useCallback(
    async (conversationId, otherUser) => {
      if (!isSocketConnected || isLoading) {
        toast.error("Not connected to server");
        return;
      }

      setIsLoading(true);
      setCallStatus("calling");

      try {
        // Get user media
        const stream = await getUserMedia();

        // Create call data
        const callData = {
          callId: null, // Will be set by server
          conversationId,
          callType: "voice",
          caller: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
          },
          recipient: otherUser,
          status: "calling",
        };

        setActiveCall(callData);
        setCallModalOpen(true);

        // Start call timeout (30 seconds)
        callTimeoutRef.current = setTimeout(() => {
          if (callStatus === "calling" || callStatus === "ringing") {
            handleCallTimeout();
          }
        }, 30000);

        // Initiate call via socket
        initiateCall(
          {
            conversationId,
            callType: "voice",
          },
          (response) => {
            setIsLoading(false);
            if (response.success) {
              setActiveCall((prev) => ({ ...prev, callId: response.callId }));
              setCallStatus("ringing");
              playRingtone();
            } else {
              setCallStatus("ended");
              setCallModalOpen(false);
              toast.error(response.error || "Failed to start call");
              // Clean up without circular dependency
              setActiveCall(null);
              setCallModalOpen(false);
              setCallStatus("idle");
              stopRingtone();
            }
          }
        );
      } catch (error) {
        setIsLoading(false);
        setCallStatus("ended");
        setCallModalOpen(false);
        console.error("Error starting call:", error);
        toast.error("Failed to start call");
      }
    },
    [isSocketConnected, isLoading, callStatus, getUserMedia, user]
  );

  // Answer incoming call
  const handleAnswerCall = useCallback(async () => {
    if (!incomingCall || isLoading) return;

    setIsLoading(true);
    setCallStatus("connecting");

    try {
      // Get user media first
      const stream = await getUserMedia();

      // Answer the call
      answerCall({ callId: incomingCall.callId }, (response) => {
        setIsLoading(false);
        if (response.success) {
          setActiveCall(incomingCall);
          setIncomingCall(null);
          setCallModalOpen(true);
          // Don't set to connected here - wait for WebRTC connection
          setCallStatus("connecting");
          stopRingtone();

          // Create peer connection after answering
          setTimeout(() => {
            if (stream) {
              const peerConnection = createPeerConnection();
              peerConnectionRef.current = peerConnection;

              // Add local stream to peer connection
              stream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, stream);
              });
            }
          }, 100);
        } else {
          // Clean up without circular dependency
          setActiveCall(null);
          setCallModalOpen(false);
          setCallStatus("idle");
          stopRingtone();
          toast.error(response.error || "Failed to answer call");
        }
      });
    } catch (error) {
      setIsLoading(false);
      // Clean up without circular dependency
      setActiveCall(null);
      setCallModalOpen(false);
      setCallStatus("idle");
      stopRingtone();
      console.error("Error answering call:", error);
      toast.error("Failed to answer call");
    }
  }, [incomingCall, isLoading, createPeerConnection, getUserMedia]);

  // Decline incoming call
  const handleDeclineCall = useCallback(() => {
    if (!incomingCall) return;

    declineCall({ callId: incomingCall.callId }, (response) => {
      if (response.success) {
        setIncomingCall(null);
        stopRingtone();
        toast("Call declined");
      }
    });
  }, [incomingCall]);

  // End active call
  const handleCallEnd = useCallback(() => {
    if (activeCall?.callId) {
      endCall({ callId: activeCall.callId });
    }

    // Clear all timeouts
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop media streams
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    setActiveCall(null);
    setCallModalOpen(false);
    setCallStatus("idle");
    stopRingtone();
  }, [localStream, remoteStream]);

  // Handle call timeout
  const handleCallTimeout = useCallback(() => {
    if (activeCall?.callId) {
      // Notify server about timeout
      endCall({ callId: activeCall.callId });
    }
    // Clean up without circular dependency
    setActiveCall(null);
    setCallModalOpen(false);
    setCallStatus("idle");
    stopRingtone();
    toast("Call timed out");
  }, [activeCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Socket event handlers
  useEffect(() => {
    if (!isSocketConnected) return;

    const socket = window.__SOCKET_INSTANCE__;
    if (!socket) return;

    // Handle incoming call
    const handleIncomingCall = (callData) => {
      setIncomingCall(callData);
      setCallStatus("incoming");
      playRingtone();
    };

    // Handle call answered
    const handleCallAnswered = async (data) => {
      console.log("Call answered event received:", data);
      if (activeCall?.callId === data.callId) {
        setCallStatus("connecting");
        stopRingtone();

        // Wait a bit for the other side to set up their peer connection
        setTimeout(async () => {
          try {
            // Create peer connection and make offer
            const peerConnection = createPeerConnection();
            peerConnectionRef.current = peerConnection;

            if (localStream) {
              localStream.getTracks().forEach((track) => {
                console.log("Adding track to peer connection:", track);
                peerConnection.addTrack(track, localStream);
              });
            }

            const offer = await peerConnection.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: false,
            });
            console.log("Created offer:", offer);
            await peerConnection.setLocalDescription(offer);

            sendRtcOffer({
              callId: data.callId,
              offer,
              to: data.callData.recipient.id,
            });
          } catch (error) {
            console.error("Error creating offer:", error);
            // Clean up without circular dependency
            setActiveCall(null);
            setCallModalOpen(false);
            setCallStatus("idle");
            stopRingtone();
          }
        }, 500); // Give the other side time to set up
      }
    };

    // Handle call declined
    const handleCallDeclined = (data) => {
      if (activeCall?.callId === data.callId) {
        // Clean up without circular dependency
        setActiveCall(null);
        setCallModalOpen(false);
        setCallStatus("idle");
        stopRingtone();
        toast("Call declined");
      }
    };

    // Handle call ended
    const handleCallEnded = (data) => {
      if (activeCall?.callId === data.callId) {
        // Clean up without circular dependency
        setActiveCall(null);
        setCallModalOpen(false);
        setCallStatus("idle");
        stopRingtone();
        toast("Call ended");
      }
    };

    // Handle ICE candidates
    const handleIceCandidate = async (data) => {
      if (peerConnectionRef.current && activeCall?.callId === data.callId) {
        try {
          await peerConnectionRef.current.addIceCandidate(data.candidate);
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    };

    // Handle RTC offer
    const handleRtcOffer = async (data) => {
      console.log("RTC offer received:", data);
      if (peerConnectionRef.current && activeCall?.callId === data.callId) {
        try {
          await peerConnectionRef.current.setRemoteDescription(data.offer);
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);

          console.log("Sending RTC answer");
          sendRtcAnswer({
            callId: data.callId,
            answer,
            to: data.from,
          });
        } catch (error) {
          console.error("Error handling offer:", error);
          // Clean up without circular dependency
          setActiveCall(null);
          setCallModalOpen(false);
          setCallStatus("idle");
          stopRingtone();
        }
      }
    };

    // Handle RTC answer
    const handleRtcAnswer = async (data) => {
      console.log("RTC answer received:", data);
      if (peerConnectionRef.current && activeCall?.callId === data.callId) {
        try {
          await peerConnectionRef.current.setRemoteDescription(data.answer);
          console.log("Remote description set successfully");
        } catch (error) {
          console.error("Error handling answer:", error);
          // Clean up without circular dependency
          setActiveCall(null);
          setCallModalOpen(false);
          setCallStatus("idle");
          stopRingtone();
        }
      }
    };

    socket.on("call_incoming", handleIncomingCall);
    socket.on("call_answered", handleCallAnswered);
    socket.on("call_declined", handleCallDeclined);
    socket.on("call_ended", handleCallEnded);
    socket.on("call_timeout", handleCallTimeout);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("rtc_offer", handleRtcOffer);
    socket.on("rtc_answer", handleRtcAnswer);

    return () => {
      socket.off("call_incoming", handleIncomingCall);
      socket.off("call_answered", handleCallAnswered);
      socket.off("call_declined", handleCallDeclined);
      socket.off("call_ended", handleCallEnded);
      socket.off("call_timeout", handleCallTimeout);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("rtc_offer", handleRtcOffer);
      socket.off("rtc_answer", handleRtcAnswer);
    };
  }, [
    isSocketConnected,
    activeCall,
    localStream,
    createPeerConnection,
    handleCallTimeout,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up media on unmount but don't end active calls
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [localStream, remoteStream]);

  return {
    // State
    activeCall,
    incomingCall,
    isCallModalOpen,
    callStatus,
    isMuted,
    isLoading,
    localStream,
    remoteStream,

    // Refs for audio elements
    localAudioRef,
    remoteAudioRef,

    // Actions
    startCall,
    handleAnswerCall,
    handleDeclineCall,
    handleCallEnd,
    toggleMute,

    // Setters
    setCallModalOpen,
  };
}
