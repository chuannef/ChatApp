import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import useAuthUser from "../hooks/useAuthUser";
import {
  getGroupById,
  getGroupAssignments,
  createGroupAssignment,
  deleteGroupAssignment,
  setGroupAssignmentCompletion,
  getGroupMessages,
  getGroupJoinRequests,
  approveGroupJoinRequest,
  rejectGroupJoinRequest,
  removeGroupMember,
} from "../lib/api";
import { getUserAvatarSrc } from "../lib/avatar";
import { getSocket } from "../lib/socket";

import { CheckIcon, TrashIcon, ImageIcon, PencilIcon, XIcon } from "lucide-react";

const GroupRoomPage = () => {
  const { id: groupId } = useParams();
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();

  const [activeTab, setActiveTab] = useState("chat");
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  const {
    data: group,
    isLoading: groupLoading,
    isError: groupIsError,
    error: groupError,
  } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroupById(groupId),
    enabled: Boolean(groupId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isAdmin = useMemo(() => {
    return Boolean(group?.admin?._id && authUser?._id && group.admin._id === authUser._id);
  }, [group, authUser]);

  const {
    data: history,
    isLoading: historyLoading,
    isError: historyIsError,
    error: historyError,
  } = useQuery({
    queryKey: ["groupMessages", groupId],
    queryFn: () => getGroupMessages(groupId),
    enabled: Boolean(groupId) && Boolean(group) && Boolean(authUser),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (history?.messages) {
      setMessages(history.messages);
    }
  }, [history?.messages]);

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["groupAssignments", groupId],
    queryFn: () => getGroupAssignments(groupId),
    enabled: Boolean(groupId) && Boolean(group),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: joinReqData,
    isLoading: joinReqLoading,
    isError: joinReqIsError,
    error: joinReqError,
  } = useQuery({
    queryKey: ["groupJoinRequests", groupId],
    queryFn: () => getGroupJoinRequests(groupId),
    enabled: Boolean(groupId) && Boolean(group) && Boolean(isAdmin) && activeTab === "members",
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const joinRequests = joinReqData?.users || [];

  const { mutate: createAssignmentMutation, isPending: creatingAssignment } = useMutation({
    mutationFn: (payload) => createGroupAssignment(groupId, payload),
    onSuccess: () => {
      toast.success("Assignment created");
      queryClient.invalidateQueries({ queryKey: ["groupAssignments", groupId] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to create assignment");
    },
  });

  const { mutate: deleteAssignmentMutation, isPending: deletingAssignment } = useMutation({
    mutationFn: ({ assignmentId }) => deleteGroupAssignment(groupId, assignmentId),
    onSuccess: () => {
      toast.success("Assignment deleted");
      queryClient.invalidateQueries({ queryKey: ["groupAssignments", groupId] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to delete assignment");
    },
  });

  const { mutate: setCompletionMutation, isPending: settingCompletion } = useMutation({
    mutationFn: ({ assignmentId, completed }) => setGroupAssignmentCompletion(groupId, assignmentId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupAssignments", groupId] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update assignment");
    },
  });

  const { mutate: approveJoinMutation, isPending: approvingJoin } = useMutation({
    mutationFn: ({ userId }) => approveGroupJoinRequest(groupId, userId),
    onSuccess: () => {
      toast.success("Approved join request");
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groupJoinRequests", groupId] });
      queryClient.invalidateQueries({ queryKey: ["myGroups"] });
      queryClient.invalidateQueries({ queryKey: ["availableGroups"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to approve request");
    },
  });

  const { mutate: rejectJoinMutation, isPending: rejectingJoin } = useMutation({
    mutationFn: ({ userId }) => rejectGroupJoinRequest(groupId, userId),
    onSuccess: () => {
      toast.success("Rejected join request");
      queryClient.invalidateQueries({ queryKey: ["groupJoinRequests", groupId] });
      queryClient.invalidateQueries({ queryKey: ["availableGroups"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to reject request");
    },
  });

  const { mutate: removeMemberMutation, isPending: removingMember } = useMutation({
    mutationFn: ({ memberId }) => removeGroupMember(groupId, memberId),
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["myGroups"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to remove member");
    },
  });

  useEffect(() => {
    if (!authUser?._id || !groupId || !group) return;
    if (activeTab !== "chat") return;

    if (historyIsError) {
      setChatError(historyError?.response?.data?.message || historyError?.message || "Failed to load messages");
      setChatLoading(false);
      return;
    }
    if (historyLoading) return;

    const socket = getSocket();
    setChatError("");
    setChatLoading(true);

    if (!socket.connected) {
      socket.connect();
    }

    const onConnectError = () => {
      setChatError("Could not connect to group chat");
      setChatLoading(false);
    };

    const onNewMessage = ({ roomId: incomingRoomId, message }) => {
      if (incomingRoomId !== `group-${groupId}`) return;
      setMessages((prev) => [...prev, message]);
    };

    const onDeletedMessage = ({ roomId: incomingRoomId, messageId }) => {
      if (incomingRoomId !== `group-${groupId}`) return;
      setMessages((prev) => prev.filter((m) => String(m._id) !== String(messageId)));
      setSelectedMessageId((prev) => (String(prev) === String(messageId) ? null : prev));
      setEditingMessageId((prev) => (String(prev) === String(messageId) ? null : prev));
    };

    const onUpdatedMessage = ({ roomId: incomingRoomId, message }) => {
      if (incomingRoomId !== `group-${groupId}`) return;
      if (!message?._id) return;
      setMessages((prev) => prev.map((m) => (String(m._id) === String(message._id) ? { ...m, ...message } : m)));
    };

    socket.on("connect_error", onConnectError);
    socket.on("message:new", onNewMessage);
    socket.on("message:deleted", onDeletedMessage);
    socket.on("message:updated", onUpdatedMessage);

    socket.emit("group:join", { groupId }, (ack) => {
      if (!ack?.ok) {
        setChatError(ack?.message || "Could not join group chat");
        setChatLoading(false);
        return;
      }
      setChatLoading(false);
    });

    return () => {
      socket.off("connect_error", onConnectError);
      socket.off("message:new", onNewMessage);
      socket.off("message:deleted", onDeletedMessage);
      socket.off("message:updated", onUpdatedMessage);
    };
  }, [authUser?._id, groupId, group, activeTab, historyLoading, historyIsError, historyError]);

  useEffect(() => {
    if (activeTab !== "chat") return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeTab]);

  const sendMessage = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const socket = getSocket();
    socket.emit("message:send", { kind: "group", groupId, text: trimmed }, (ack) => {
      if (!ack?.ok) {
        toast.error(ack?.message || "Failed to send message");
        return;
      }
      setText("");
    });
  };

  const sendImage = async (file) => {
    try {
      if (!file) return;
      if (!file.type?.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

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
      socket.emit("message:send", { kind: "group", groupId, image: dataUrl }, (ack) => {
        if (!ack?.ok) {
          toast.error(ack?.message || "Failed to send image");
        }
      });
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

  const toggleSelectMessage = (messageId) => {
    const id = String(messageId || "");
    if (!id) return;
    setSelectedMessageId((prev) => (String(prev) === id ? null : id));
    setEditingMessageId(null);
    setEditingText("");
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

      setMessages((prev) => prev.map((m) => (String(m._id) === String(messageId) ? { ...m, text: trimmed } : m)));
      setEditingMessageId(null);
      setEditingText("");
    });
  };

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const submitAssignment = (e) => {
    e.preventDefault();
    createAssignmentMutation({
      title: newTitle,
      description: newDescription,
      dueDate: newDueDate ? newDueDate : null,
    });
    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
  };

  if (groupLoading) {
    return (
      <div className="p-6 flex justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (groupIsError) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>
            Failed to load group: {groupError?.response?.data?.message || groupError?.message || "Network Error"}
          </span>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-6">
        <div className="card bg-base-200 p-6">Group not found</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-5xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{group.name}</h1>
            <p className="opacity-70">{group.members?.length || 0} members</p>
          </div>

          <div className="tabs tabs-boxed">
            <button className={`tab ${activeTab === "chat" ? "tab-active" : ""}`} onClick={() => setActiveTab("chat")}>
              Chat
            </button>
            <button className={`tab ${activeTab === "assignments" ? "tab-active" : ""}`} onClick={() => setActiveTab("assignments")}>
              Assignments
            </button>
            <button className={`tab ${activeTab === "members" ? "tab-active" : ""}`} onClick={() => setActiveTab("members")}>
              Members
            </button>
          </div>
        </div>

        {activeTab === "chat" && (
          <div className="card bg-base-200">
            <div className="card-body p-0">
              {chatError ? (
                <div className="p-6">
                  <div className="alert alert-error">
                    <span>{chatError}</span>
                  </div>
                </div>
              ) : chatLoading ? (
                <div className="p-6 flex justify-center">
                  <span className="loading loading-spinner loading-lg" />
                </div>
              ) : (
                <div className="h-[calc(70vh-10px)] flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {messages.length === 0 ? (
                      <div className="opacity-70">No messages yet.</div>
                    ) : (
                      messages.map((m) => {
                        const isMine = String(m.sender?._id || m.sender) === String(authUser?._id);
                        const canDelete = isMine || isAdmin;
                        const id = m._id ? String(m._id) : "";
                        const isSelected = Boolean(id) && String(selectedMessageId) === id;
                        const isEditing = Boolean(id) && String(editingMessageId) === id;
                        const canEdit = isMine && Boolean(m.text) && Boolean(m._id);
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
                              {m.image ? <img src={m.image} alt="sent" className="max-w-[240px] rounded" /> : null}

                              {m.text ? (
                                isEditing ? (
                                  <div className={m.image ? "mt-2" : ""}>
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
                                  <div className={m.image ? "mt-2" : ""}>{m.text}</div>
                                )
                              ) : null}

                              {isSelected && m._id && !isEditing ? (
                                <div className="mt-2 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  {canEdit ? (
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => beginEditMessage(m)}>
                                      <PencilIcon className="size-4" />
                                    </button>
                                  ) : null}
                                  {canDelete ? (
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => deleteMessage(m._id)}>
                                      <TrashIcon className="size-4" />
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={endRef} />
                  </div>

                  <form onSubmit={sendMessage} className="p-3 border-t bg-base-200">
                    <div className="flex gap-2">
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
              )}
            </div>
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="space-y-4">
            {isAdmin && (
              <div className="card bg-base-200">
                <div className="card-body">
                  <h2 className="font-semibold text-lg">Create assignment</h2>
                  <form onSubmit={submitAssignment} className="space-y-3">
                    <input
                      className="input input-bordered w-full"
                      placeholder="Title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                    <textarea
                      className="textarea textarea-bordered w-full"
                      placeholder="Description (optional)"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                    <input
                      type="date"
                      className="input input-bordered w-full"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                    />
                    <button className="btn btn-primary" disabled={creatingAssignment} type="submit">
                      Create
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="card bg-base-200">
              <div className="card-body">
                <h2 className="font-semibold text-lg">Assignments</h2>

                {assignmentsLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-lg" />
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="opacity-70">No assignments yet.</div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((a) => {
                      const done = (a.completedBy || []).some((u) => String(u?._id || u) === String(authUser?._id));
                      const completedNames = (a.completedBy || [])
                        .map((u) => (u && typeof u === "object" ? u.fullName : ""))
                        .filter(Boolean);

                      return (
                        <div key={a._id} className="card bg-base-100">
                          <div className="card-body p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${done ? "btn-success" : "btn-outline"}`}
                                    onClick={() => setCompletionMutation({ assignmentId: a._id, completed: !done })}
                                    disabled={settingCompletion}
                                  >
                                    <CheckIcon className="size-4" />
                                  </button>
                                  <h3 className={`font-semibold ${done ? "line-through opacity-70" : ""}`}>{a.title}</h3>
                                </div>
                                {a.description && <p className="text-sm opacity-80 mt-2 whitespace-pre-wrap">{a.description}</p>}
                                {a.dueDate && (
                                  <p className="text-xs opacity-70 mt-2">Due: {new Date(a.dueDate).toLocaleDateString()}</p>
                                )}

                                <p className="text-xs opacity-70 mt-2">
                                  Completed by: {completedNames.length ? completedNames.join(", ") : "No one yet"}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => deleteAssignmentMutation({ assignmentId: a._id })}
                                    disabled={deletingAssignment}
                                  >
                                    <TrashIcon className="size-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="card bg-base-200">
              <div className="card-body">
                <h2 className="font-semibold text-lg">Members</h2>

                <div className="space-y-2">
                  {(group.members || []).map((m) => {
                    const isGroupAdmin = String(m?._id) === String(group.admin?._id);
                    return (
                      <div key={m._id} className="flex items-center justify-between gap-3 p-2 rounded bg-base-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="avatar">
                            <div className="w-10 rounded-full">
                              <img src={getUserAvatarSrc(m)} alt={m.fullName || "User"} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{m.fullName || "User"}</div>
                            {isGroupAdmin && <div className="text-xs opacity-70">Admin</div>}
                          </div>
                        </div>

                        {isAdmin && !isGroupAdmin && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={removingMember}
                            onClick={() => removeMemberMutation({ memberId: m._id })}
                          >
                            <TrashIcon className="size-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="card bg-base-200">
                <div className="card-body">
                  <h2 className="font-semibold text-lg">Join requests</h2>

                  {joinReqIsError ? (
                    <div className="alert alert-error">
                      <span>{joinReqError?.response?.data?.message || joinReqError?.message || "Failed to load join requests"}</span>
                    </div>
                  ) : joinReqLoading ? (
                    <div className="flex justify-center py-6">
                      <span className="loading loading-spinner loading-lg" />
                    </div>
                  ) : joinRequests.length === 0 ? (
                    <div className="opacity-70">No pending requests.</div>
                  ) : (
                    <div className="space-y-2">
                      {joinRequests.map((u) => (
                        <div key={u._id} className="flex items-center justify-between gap-3 p-2 rounded bg-base-100">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="avatar">
                              <div className="w-10 rounded-full">
                                <img src={getUserAvatarSrc(u)} alt={u.fullName || "User"} />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{u.fullName || "User"}</div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              disabled={approvingJoin}
                              onClick={() => approveJoinMutation({ userId: u._id })}
                            >
                              <CheckIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={rejectingJoin}
                              onClick={() => rejectJoinMutation({ userId: u._id })}
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupRoomPage;
