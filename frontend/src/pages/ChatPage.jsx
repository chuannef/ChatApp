import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getDmMessages, getUserFriends } from "../lib/api";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import CallButton from "../components/CallButton";
import { getUserAvatarSrc } from "../lib/avatar";
import { getSocket } from "../lib/socket";
import { ImageIcon } from "lucide-react";
import { TrashIcon } from "lucide-react";

function dmRoomId(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].map(String).sort();
  return `dm-${a}-${b}`;
}

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();

  const [joining, setJoining] = useState(true);
  const [chatError, setChatError] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  const { authUser } = useAuthUser();

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
    staleTime: 0,
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
      setJoining(false);
      return;
    }
    if (historyLoading) return;

    const socket = getSocket();
    setChatError("");
    setJoining(true);

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
    };

    socket.on("connect_error", onConnectError);
    socket.on("message:new", onNewMessage);
    socket.on("message:deleted", onDeletedMessage);

    socket.emit("dm:join", { otherUserId: targetUserId }, (ack) => {
      if (!ack?.ok) {
        setChatError(ack?.message || "Could not join chat");
        setJoining(false);
        return;
      }

      setJoining(false);
    });

    return () => {
      socket.off("connect_error", onConnectError);
      socket.off("message:new", onNewMessage);
      socket.off("message:deleted", onDeletedMessage);
    };
  }, [authUser?._id, targetUserId, roomId, historyLoading, historyIsError, historyError]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleVideoCall = () => {
    if (!roomId) return;

    const callUrl = `${window.location.origin}/call/${roomId}`;
    const socket = getSocket();

    socket.emit(
      "message:send",
      {
        kind: "dm",
        otherUserId: targetUserId,
        text: `I've started a video call. Join me here:\n${callUrl}`,
      },
      (ack) => {
        if (!ack?.ok) {
          toast.error(ack?.message || "Failed to send call link");
          return;
        }
        toast.success("Video call link sent successfully!");
      }
    );
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

  const sendImage = async (file) => {
    try {
      if (!file) return;
      if (!roomId) return;

      if (!file.type?.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      // limit ~700KB raw to reduce DB bloat (data URL expands size)
      if (file.size > 700 * 1024) {
        toast.error("Image is too large (max ~700KB)");
        return;
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

      const socket = getSocket();
      socket.emit(
        "message:send",
        { kind: "dm", otherUserId: targetUserId, image: dataUrl },
        (ack) => {
          if (!ack?.ok) {
            toast.error(ack?.message || "Failed to send image");
            return;
          }
        }
      );
    } catch (err) {
      toast.error(err?.message || "Failed to send image");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  if (historyLoading || joining) return <ChatLoader />;

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
              <div className="font-semibold truncate">{friend?.fullName || "Chat"}</div>
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
            return (
              <div key={m._id || `${m.createdAt}-${m.text}`} className={`chat ${isMine ? "chat-end" : "chat-start"}`}>
                <div className="chat-image avatar">
                  <div className="w-8 rounded-full">
                    <img src={getUserAvatarSrc(m.sender)} alt={m.sender?.fullName || "User"} />
                  </div>
                </div>
                <div className="chat-header opacity-70 text-xs">{m.sender?.fullName || ""}</div>
                <div className={`chat-bubble ${isMine ? "chat-bubble-primary" : ""}`}>
                  {m.image ? (
                    <img src={m.image} alt="sent" className="max-w-[240px] rounded" />
                  ) : null}
                  {m.text ? <div className={m.image ? "mt-2" : ""}>{m.text}</div> : null}

                  {isMine && m._id ? (
                    <div className="mt-2 flex justify-end">
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
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileInputRef.current?.click()}
            title="Send image"
          >
            <ImageIcon className="size-5" />
          </button>
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
