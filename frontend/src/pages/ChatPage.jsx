import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getDmMessages, getUserFriends, uploadChatFile } from "../lib/api";
import toast from "react-hot-toast";
import JSZip from "jszip";

import ChatLoader from "../components/ChatLoader";
import CallButton from "../components/CallButton";
import { getUserAvatarSrc } from "../lib/avatar";
import { getSocket } from "../lib/socket";
import { PaperclipIcon, TrashIcon, PencilIcon, CheckIcon, XIcon } from "lucide-react";
import { usePresenceStore } from "../store/usePresenceStore";

function dmRoomId(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].map(String).sort();
  return `dm-${a}-${b}`;
}

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();

  const [chatError, setChatError] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const anyFileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

  const { authUser } = useAuthUser();
  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds);

  const friendIsOnline = useMemo(() => {
    if (!targetUserId) return false;
    return onlineUserIds?.has?.(String(targetUserId)) || false;
  }, [onlineUserIds, targetUserId]);

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    enabled: !!authUser,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const friend = useMemo(() => {
    return friends.find((f) => f._id === targetUserId) || null;
  }, [friends, targetUserId]);

  const roomId = useMemo(() => {
    if (!authUser?._id || !targetUserId) return "";
    return dmRoomId(authUser._id, targetUserId);
  }, [authUser?._id, targetUserId]);

  const {
    data: history,
    isLoading: historyLoading,
    isError: historyIsError,
    error: historyError,
  } = useQuery({
    queryKey: ["dmMessages", targetUserId],
    queryFn: () => getDmMessages(targetUserId),
    enabled: !!authUser && !!targetUserId,
    // Cache a bit so navigating in/out of chat is instant.
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (history?.messages) {
      setMessages(history.messages);
    }
  }, [history?.messages]);

  useEffect(() => {
    if (!authUser?._id || !targetUserId) return;
    if (historyIsError) {
      setChatError(historyError?.response?.data?.message || historyError?.message || "Failed to load messages");
      return;
    }
    if (historyLoading) return;

    const socket = getSocket();
    setChatError("");

    if (!socket.connected) {
      socket.connect();
    }

    const onConnectError = () => {
      setChatError("Could not connect to chat");
      setJoining(false);
    };

    const onNewMessage = ({ roomId: incomingRoomId, message }) => {
      if (!incomingRoomId || incomingRoomId !== roomId) return;
      setMessages((prev) => [...prev, message]);
    };

    const onDeletedMessage = ({ roomId: incomingRoomId, messageId }) => {
      if (!incomingRoomId || incomingRoomId !== roomId) return;
      setMessages((prev) => prev.filter((m) => String(m._id) !== String(messageId)));
      setSelectedMessageId((prev) => (String(prev) === String(messageId) ? null : prev));
      setEditingMessageId((prev) => (String(prev) === String(messageId) ? null : prev));
    };

    const onUpdatedMessage = ({ roomId: incomingRoomId, message }) => {
      if (!incomingRoomId || incomingRoomId !== roomId) return;
      if (!message?._id) return;

      setMessages((prev) => prev.map((m) => (String(m._id) === String(message._id) ? { ...m, ...message } : m)));
    };

    socket.on("connect_error", onConnectError);
    socket.on("message:new", onNewMessage);
    socket.on("message:deleted", onDeletedMessage);
    socket.on("message:updated", onUpdatedMessage);

    socket.emit("dm:join", { otherUserId: targetUserId }, (ack) => {
      if (!ack?.ok) {
        setChatError(ack?.message || "Could not join chat");
        return;
      }
    });

    return () => {
      socket.off("connect_error", onConnectError);
      socket.off("message:new", onNewMessage);
      socket.off("message:deleted", onDeletedMessage);
      socket.off("message:updated", onUpdatedMessage);
    };
  }, [authUser?._id, targetUserId, roomId, historyLoading, historyIsError, historyError]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleVideoCall = () => {
    if (!roomId) return;

    const callUrl = `${window.location.origin}/call/${roomId}`;

    // Let the caller join immediately in a new tab.
    const win = window.open(callUrl, "_blank");
    if (win) win.opener = null;
    else toast.error("Popup blocked. Please allow popups to join the call.");
  };

  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const socket = getSocket();

    socket.emit(
      "message:send",
      { kind: "dm", otherUserId: targetUserId, text: trimmed },
      (ack) => {
        if (!ack?.ok) {
          toast.error(ack?.message || "Failed to send message");
          return;
        }
        setText("");
      }
    );
  };

  const sendAttachment = async (file, kind) => {
    try {
      if (!file) return;
      if (!roomId) return;

      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error("File is too large (max 100MB)");
        return;
      }

      const uploaded = await uploadChatFile(file);

      const socket = getSocket();
      socket.emit(
        "message:send",
        {
          kind: "dm",
          otherUserId: targetUserId,
          attachment: {
            url: uploaded?.url,
            path: uploaded?.path,
            name: uploaded?.name || file.name,
            size: uploaded?.size || file.size,
            type: uploaded?.type || file.type,
            kind,
          },
        },
        (ack) => {
          if (!ack?.ok) {
            toast.error(ack?.message || "Failed to send file");
          }
        }
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to send file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (anyFileInputRef.current) anyFileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const sendImage = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    await sendAttachment(file, "image");
  };

  const sendFile = async (file) => {
    if (!file) return;
    await sendAttachment(file, "file");
  };

  const sendFolder = async (fileList) => {
    try {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;
      if (!roomId) return;

      toast.loading("Preparing folder...", { id: "zip-folder" });

      const zip = new JSZip();
      const firstRel = files[0]?.webkitRelativePath || files[0]?.name || "folder";
      const folderName = String(firstRel).split("/")[0] || "folder";

      for (const f of files) {
        const rel = f.webkitRelativePath || f.name;
        const cleanRel = String(rel || "").replace(/^\/+/, "");
        zip.file(cleanRel, f);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const zipped = new File([blob], `${folderName}.zip`, { type: "application/zip" });

      toast.dismiss("zip-folder");

      if (zipped.size > MAX_UPLOAD_BYTES) {
        toast.error("Folder is too large after zip (max 100MB)");
        return;
      }

      await sendAttachment(zipped, "folder");
    } catch (err) {
      toast.dismiss("zip-folder");
      toast.error(err?.message || "Failed to zip folder");
    } finally {
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const deleteMessage = (messageId) => {
    const socket = getSocket();
    socket.emit("message:delete", { messageId }, (ack) => {
      if (!ack?.ok) {
        toast.error(ack?.message || "Failed to delete message");
      }
    });
  };

  const beginEditMessage = (message) => {
    if (!message?._id) return;
    const currentText = String(message.text || "");
    setSelectedMessageId(String(message._id));
    setEditingMessageId(String(message._id));
    setEditingText(currentText);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const saveEditMessage = (messageId) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      toast.error("Message cannot be empty");
      return;
    }

    const socket = getSocket();
    socket.emit("message:edit", { messageId, text: trimmed }, (ack) => {
      if (!ack?.ok) {
        toast.error(ack?.message || "Failed to edit message");
        return;
      }

      // Optimistic update in case broadcast is delayed.
      setMessages((prev) => prev.map((m) => (String(m._id) === String(messageId) ? { ...m, text: trimmed } : m)));
      setEditingMessageId(null);
      setEditingText("");
    });
  };

  const toggleSelectMessage = (messageId) => {
    const id = String(messageId || "");
    if (!id) return;
    setSelectedMessageId((prev) => (String(prev) === id ? null : id));
    setEditingMessageId(null);
    setEditingText("");
  };

  if (historyLoading) return <ChatLoader />;

  if (chatError) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>{chatError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(93vh-10px)] flex flex-col">
      <div className="border-b bg-base-200">
        <div className="max-w-7xl mx-auto w-full px-4 py-3 flex items-center gap-3">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            Back
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="avatar">
              <div className="w-10 rounded-full">
                <img src={getUserAvatarSrc(friend)} alt={friend?.fullName || "User"} />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold truncate">{friend?.fullName || "Chat"}</div>
                <span className={`badge badge-sm ${friendIsOnline ? "badge-success" : "badge-ghost"}`}>
                  {friendIsOnline ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          <CallButton handleVideoCall={handleVideoCall} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="opacity-70">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const isMine = String(m.sender?._id || m.sender) === String(authUser?._id);
            const id = m._id ? String(m._id) : "";
            const isSelected = Boolean(id) && String(selectedMessageId) === id;
            const isEditing = Boolean(id) && String(editingMessageId) === id;
            const canEdit = isMine && Boolean(m.text) && Boolean(m._id);
            const hasMedia = Boolean(m.image || m.attachment?.url);
            return (
              <div key={m._id || `${m.createdAt}-${m.text}`} className={`chat ${isMine ? "chat-end" : "chat-start"}`}>
                <div className="chat-image avatar">
                  <div className="w-8 rounded-full">
                    <img src={getUserAvatarSrc(m.sender)} alt={m.sender?.fullName || "User"} />
                  </div>
                </div>
                <div className="chat-header opacity-70 text-xs">{m.sender?.fullName || ""}</div>
                <div
                  className={`chat-bubble ${isMine ? "chat-bubble-primary" : ""} ${m._id ? "cursor-pointer" : ""}`}
                  onClick={() => (m._id ? toggleSelectMessage(m._id) : undefined)}
                >
                  {m.attachment?.url ? (
                    m.attachment?.type?.startsWith?.("image/") || m.attachment?.kind === "image" ? (
                      <img src={m.attachment.url} alt={m.attachment?.name || "attachment"} className="max-w-[240px] rounded" />
                    ) : (
                      <a
                        href={m.attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {m.attachment?.name || "Download file"}
                      </a>
                    )
                  ) : m.image ? (
                    <img src={m.image} alt="sent" className="max-w-[240px] rounded" />
                  ) : null}

                  {m.text ? (
                    isEditing ? (
                      <div className={hasMedia ? "mt-2" : ""}>
                        <textarea
                          className="textarea textarea-bordered w-full"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          rows={2}
                        />

                        <div className="mt-2 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn btn-primary btn-xs" onClick={() => saveEditMessage(m._id)}>
                            <CheckIcon className="size-4" />
                          </button>
                          <button type="button" className="btn btn-ghost btn-xs" onClick={cancelEditMessage}>
                            <XIcon className="size-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={hasMedia ? "mt-2" : ""}>{m.text}</div>
                    )
                  ) : null}

                  {isSelected && isMine && m._id && !isEditing ? (
                    <div className="mt-2 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => beginEditMessage(m)}>
                          <PencilIcon className="size-4" />
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => deleteMessage(m._id)}>
                        <TrashIcon className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t bg-base-200">
        <div className="max-w-7xl mx-auto w-full flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => sendImage(e.target.files?.[0])}
          />
          <input
            ref={anyFileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => sendFile(e.target.files?.[0])}
          />
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            webkitdirectory=""
            directory=""
            multiple
            onChange={(e) => sendFolder(e.target.files)}
          />

          <div className="dropdown dropdown-top">
            <button type="button" tabIndex={0} className="btn btn-ghost" title="Attach">
              <PaperclipIcon className="size-5" />
            </button>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-200 rounded-box w-44">
              <li>
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  Image
                </button>
              </li>
              <li>
                <button type="button" onClick={() => anyFileInputRef.current?.click()}>
                  File
                </button>
              </li>
              <li>
                <button type="button" onClick={() => folderInputRef.current?.click()}>
                  Folder
                </button>
              </li>
            </ul>
          </div>
          <input
            className="input input-bordered flex-1"
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">
            Send
          </button>
        </div>
      </form>
    </div>
  );
};
export default ChatPage;
