import { axiosInstance } from "./axios";

export const signup = async (signupData) => {
  const response = await axiosInstance.post("/auth/signup", signupData);
  try {
    if (response?.data?.user) {
      localStorage.setItem("authUser", JSON.stringify(response.data.user));
    }
  } catch {
    // ignore storage errors
  }
  return response.data;
};

export const login = async (loginData) => {
  const response = await axiosInstance.post("/auth/login", loginData);
  try {
    if (response?.data?.user) {
      localStorage.setItem("authUser", JSON.stringify(response.data.user));
    }
  } catch {
    // ignore storage errors
  }
  return response.data;
};
export const logout = async () => {
  const response = await axiosInstance.post("/auth/logout");
  try {
    localStorage.removeItem("authUser");
  } catch {
    // ignore storage errors
  }
  return response.data;
};

export const getAuthUser = async () => {
  try {
    const res = await axiosInstance.get("/auth/me");
    try {
      if (res?.data?.user) {
        localStorage.setItem("authUser", JSON.stringify(res.data.user));
      }
    } catch {
      // ignore storage errors
    }
    return res.data;
  } catch (error) {
    console.log("Error in getAuthUser:", error);
    try {
      localStorage.removeItem("authUser");
    } catch {
      // ignore storage errors
    }
    return null;
  }
};

export const completeOnboarding = async (userData) => {
  const response = await axiosInstance.post("/auth/onboarding", userData);
  return response.data;
};

export async function getUserFriends() {
  const response = await axiosInstance.get("/users/friends");
  return response.data;
}

export async function removeFriend(userId) {
  const response = await axiosInstance.delete(`/users/friends/${userId}`);
  return response.data;
}

export async function getRecommendedUsers() {
  const response = await axiosInstance.get("/users");
  return response.data;
}

export async function getOutgoingFriendReqs() {
  const response = await axiosInstance.get("/users/outgoing-friend-requests");
  return response.data;
}

export async function sendFriendRequest(userId) {
  const response = await axiosInstance.post(`/users/friend-request/${userId}`);
  return response.data;
}

export async function getFriendRequests() {
  const response = await axiosInstance.get("/users/friend-requests");
  return response.data;
}

export async function acceptFriendRequest(requestId) {
  const response = await axiosInstance.put(`/users/friend-request/${requestId}/accept`);
  return response.data;
}

export async function declineFriendRequest(requestId) {
  const response = await axiosInstance.put(`/users/friend-request/${requestId}/decline`);
  return response.data;
}

// Group invitations (Notifications)
export async function getGroupInvitations() {
  const response = await axiosInstance.get("/users/group-invitations");
  return response.data;
}

export async function acceptGroupInvitation(invitationId) {
  const response = await axiosInstance.put(`/users/group-invitations/${invitationId}/accept`);
  return response.data;
}

export async function declineGroupInvitation(invitationId) {
  const response = await axiosInstance.put(`/users/group-invitations/${invitationId}/decline`);
  return response.data;
}

export async function getStreamToken() {
  const response = await axiosInstance.get("/chat/token", { timeout: 15000 });
  return response.data;
}

// Messages (Socket.IO chat)
export async function getDmMessages(userId) {
  const response = await axiosInstance.get(`/messages/dm/${userId}`);
  return response.data;
}

export async function getGroupMessages(groupId) {
  const response = await axiosInstance.get(`/messages/group/${groupId}`);
  return response.data;
}

// Group APIs
export async function getMyGroups() {
  const response = await axiosInstance.get("/groups/my-groups");
  return response.data;
}

export async function getAvailableGroups() {
  const response = await axiosInstance.get("/groups/available");
  return response.data;
}

export async function createGroup(groupData) {
  const response = await axiosInstance.post("/groups", groupData);
  return response.data;
}

export async function joinGroup(groupId) {
  const response = await axiosInstance.post(`/groups/${groupId}/join`);
  return response.data;
}

export async function getGroupJoinRequests(groupId) {
  const response = await axiosInstance.get(`/groups/${groupId}/join-requests`);
  return response.data;
}

export async function approveGroupJoinRequest(groupId, userId) {
  const response = await axiosInstance.post(`/groups/${groupId}/join-requests/${userId}/approve`);
  return response.data;
}

export async function rejectGroupJoinRequest(groupId, userId) {
  const response = await axiosInstance.post(`/groups/${groupId}/join-requests/${userId}/reject`);
  return response.data;
}

export async function removeGroupMember(groupId, memberId) {
  const response = await axiosInstance.delete(`/groups/${groupId}/members/${memberId}`);
  return response.data;
}

export async function leaveGroup(groupId) {
  const response = await axiosInstance.post(`/groups/${groupId}/leave`);
  return response.data;
}

export async function deleteGroup(groupId) {
  const response = await axiosInstance.delete(`/groups/${groupId}`);
  return response.data;
}

export async function getGroupById(groupId) {
  const response = await axiosInstance.get(`/groups/${groupId}`);
  return response.data;
}

// Group Assignments APIs
export async function getGroupAssignments(groupId) {
  const response = await axiosInstance.get(`/groups/${groupId}/assignments`);
  return response.data;
}

export async function createGroupAssignment(groupId, payload) {
  const response = await axiosInstance.post(`/groups/${groupId}/assignments`, payload);
  return response.data;
}

export async function deleteGroupAssignment(groupId, assignmentId) {
  const response = await axiosInstance.delete(`/groups/${groupId}/assignments/${assignmentId}`);
  return response.data;
}

export async function setGroupAssignmentCompletion(groupId, assignmentId, completed) {
  const response = await axiosInstance.post(
    `/groups/${groupId}/assignments/${assignmentId}/complete`,
    typeof completed === "boolean" ? { completed } : {}
  );
  return response.data;
}

