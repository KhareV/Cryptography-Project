import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
} from "date-fns";

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format message timestamp
 */
export function formatMessageTime(date) {
  if (!date) return "";
  const d = new Date(date);
  return format(d, "h:mm a");
}

/**
 * Format conversation timestamp
 */
export function formatConversationTime(date) {
  if (!date) return "";
  const d = new Date(date);

  if (isToday(d)) {
    return format(d, "h:mm a");
  }

  if (isYesterday(d)) {
    return "Yesterday";
  }

  if (isThisWeek(d)) {
    return format(d, "EEEE");
  }

  return format(d, "MMM d");
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Format date separator
 */
export function formatDateSeparator(date) {
  if (!date) return "";
  const d = new Date(date);

  if (isToday(d)) {
    return "Today";
  }

  if (isYesterday(d)) {
    return "Yesterday";
  }

  return format(d, "MMMM d, yyyy");
}

/**
 * Check if two dates are on different days
 */
export function isDifferentDay(date1, date2) {
  if (!date1 || !date2) return true;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getDate() !== d2.getDate() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getFullYear() !== d2.getFullYear()
  );
}

/**
 * Truncate text
 */
export function truncate(text, maxLength = 50) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Get initials from name
 */
export function getInitials(name) {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generate avatar color from string
 */
export function getAvatarColor(str) {
  if (!str) return "bg-gray-500";

  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Play notification sound
 */
export function playNotificationSound() {
  try {
    const audio = new Audio("/sounds/notification. mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {
    // Ignore audio errors
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;

  if (Notification.permission === "granted") return true;

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

/**
 * Show browser notification
 */
export function showNotification(title, options = {}) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    icon: "/images/logo.png",
    badge: "/images/badge.png",
    ...options,
  });
}

// Call audio handling
let ringtoneAudio = null;

/**
 * Play ringtone sound
 */
export function playRingtone() {
  try {
    // Stop existing ringtone if playing
    stopRingtone();

    // Create new audio instance
    ringtoneAudio = new Audio("/sounds/ringtone.mp3");
    ringtoneAudio.loop = true;
    ringtoneAudio.volume = 0.7;

    // Handle loading errors gracefully
    ringtoneAudio.addEventListener("error", (e) => {
      console.warn("Ringtone file not found, using silent notification");
    });

    // Play ringtone
    ringtoneAudio.play().catch((err) => {
      console.warn("Failed to play ringtone:", err);
      // Fallback: try to use a beep sound or system notification
    });
  } catch (error) {
    console.warn("Error playing ringtone:", error);
  }
}

/**
 * Stop ringtone sound
 */
export function stopRingtone() {
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
    ringtoneAudio = null;
  }
}

/**
 * Format call duration
 */
export function formatCallDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const durationMs = end - start;
  const totalSeconds = Math.floor(durationMs / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
