"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Paperclip, X, Image as ImageIcon } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { uploadAPI } from "@/lib/api";
import toast from "react-hot-toast";

export default function MessageInput({
  onSend,
  onTyping,
  isSending,
  disabled,
  verificationWarning = false,
  warningText = "Recipient key is not verified on-chain yet.",
}) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea
  const handleInput = useCallback(
    (e) => {
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;

      setMessage(e.target.value);
      onTyping?.();
    },
    [onTyping],
  );

  // Handle send
  const handleSend = useCallback(async () => {
    if (!message.trim() && attachments.length === 0) return;

    try {
      // Upload attachments first if any
      if (attachments.length > 0) {
        setIsUploading(true);

        for (const file of attachments) {
          try {
            const response = await uploadAPI.uploadFile(file);
            const fileData = response.data;

            // Determine message type based on file type
            const messageType = fileData.type === "image" ? "image" : "file";

            // For images, send empty content (image will be displayed via fileUrl)
            // For files, send filename as content
            const messageContent =
              fileData.type === "image"
                ? message.trim() || ""
                : message.trim() || file.name;

            // Send message with file
            await onSend?.(messageContent, messageType, null, fileData.fileUrl);
          } catch (error) {
            console.error("File upload error:", error);
            toast.error(`Failed to upload ${file.name}`);
          }
        }

        setIsUploading(false);
      } else {
        // Send text message only
        await onSend?.(message.trim());
      }

      setMessage("");
      setAttachments([]);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Send error:", error);
      setIsUploading(false);
    }
  }, [message, attachments, onSend]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Handle emoji select
  const handleEmojiClick = useCallback((emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }, []);

  // Handle file select
  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  }, []);

  // Remove attachment
  const removeAttachment = useCallback((index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="relative border-t border-border/70 bg-background/95 backdrop-blur px-4 py-3">
      {verificationWarning && (
        <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {warningText}
        </div>
      )}

      {/* Attachments Preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex gap-2 mb-3 overflow-x-auto pb-2"
          >
            {attachments.map((file, index) => (
              <div
                key={index}
                className="relative flex-shrink-0 w-20 h-20 rounded-xl bg-background-secondary border border-border/80 overflow-hidden group shadow-sm"
              >
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-foreground-secondary" />
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(index)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="flex items-end gap-2 rounded-2xl border border-border/80 bg-background-secondary/60 p-2">
        {/* Attachment Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="w-5 h-5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Emoji Picker */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={disabled}
          >
            <Smile className="w-5 h-5" />
          </Button>

          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute bottom-full left-0 mb-2 z-50"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme="auto"
                  lazyLoadEmojis
                  searchPlaceholder="Search emoji..."
                  width={320}
                  height={400}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full px-4 py-2.5 rounded-2xl resize-none",
              "bg-background border border-border/80",
              "text-foreground placeholder:text-foreground-secondary",
              "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all duration-200",
              "max-h-[150px] overflow-y-auto",
            )}
          />
        </div>

        {/* Send Button */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="primary"
            size="icon"
            onClick={handleSend}
            disabled={
              disabled ||
              isSending ||
              isUploading ||
              (!message.trim() && attachments.length === 0)
            }
            className="rounded-full w-10 h-10"
          >
            {isSending || isUploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </motion.div>
      </div>

      {/* Click outside to close emoji picker */}
      {showEmojiPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
}
