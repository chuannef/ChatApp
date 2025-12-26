import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptFriendRequest,
  acceptGroupInvitation,
  declineFriendRequest,
  declineGroupInvitation,
  getFriendRequests,
  getGroupInvitations,
} from "../lib/api";
import { BellIcon, ClockIcon, MessageSquareIcon, UserCheckIcon } from "lucide-react";
import NoNotificationsFound from "../components/NoNotificationsFound";
import { getUserAvatarSrc } from "../lib/avatar";

const NotificationsPage = () => {
  const queryClient = useQueryClient();

  const { data: friendRequests, isLoading } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: groupInvites, isLoading: groupInvitesLoading } = useQuery({
    queryKey: ["groupInvitations"],
    queryFn: getGroupInvitations,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const { mutate: acceptRequestMutation, isPending } = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const { mutate: declineRequestMutation, isPending: declining } = useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    },
  });

  const { mutate: acceptInviteMutation, isPending: acceptingInvite } = useMutation({
    mutationFn: acceptGroupInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupInvitations"] });
      queryClient.invalidateQueries({ queryKey: ["myGroups"] });
      queryClient.invalidateQueries({ queryKey: ["availableGroups"] });
    },
  });

  const { mutate: declineInviteMutation, isPending: decliningInvite } = useMutation({
    mutationFn: declineGroupInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupInvitations"] });
    },
  });

  const incomingRequests = friendRequests?.incomingReqs || [];
  const acceptedRequests = friendRequests?.acceptedReqs || [];
  const pendingGroupInvites = groupInvites?.invitations || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Notifications</h1>

        {isLoading || groupInvitesLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <>
            {pendingGroupInvites.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BellIcon className="h-5 w-5 text-primary" />
                  Group Invitations
                  <span className="badge badge-primary ml-2">{pendingGroupInvites.length}</span>
                </h2>

                <div className="space-y-3">
                  {pendingGroupInvites.filter(Boolean).map((inv) => (
                    <div key={inv._id} className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="avatar">
                              <div className="w-14 rounded-full bg-base-300">
                                <img
                                  className="rounded-full"
                                  src={getUserAvatarSrc(inv.sender)}
                                  alt={inv.sender?.fullName || "User"}
                                />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold truncate">{inv.group?.name || "Group"}</h3>
                              <p className="text-sm opacity-80 truncate">
                                {inv.sender?.fullName || "Someone"} invited you to join
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => acceptInviteMutation(inv._id)}
                              disabled={acceptingInvite || decliningInvite}
                            >
                              Join
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => declineInviteMutation(inv._id)}
                              disabled={acceptingInvite || decliningInvite}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {incomingRequests.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <UserCheckIcon className="h-5 w-5 text-primary" />
                  Friend Requests
                  <span className="badge badge-primary ml-2">{incomingRequests.length}</span>
                </h2>

                <div className="space-y-3">
                  {incomingRequests.filter(Boolean).map((request) => (
                    <div
                      key={request._id}
                      className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="w-14 rounded-full bg-base-300">
                                <img
                                  className="rounded-full"
                                  src={getUserAvatarSrc(request.sender)}
                                  alt={request.sender?.fullName || "User"}
                                />
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold">{request.sender?.fullName || "User"}</h3>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className="badge badge-secondary badge-sm">
                                  Native: {request.sender?.nativeLanguage || ""}
                                </span>
                                <span className="badge badge-outline badge-sm">
                                  Learning: {request.sender?.learningLanguage || ""}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => acceptRequestMutation(request._id)}
                              disabled={isPending || declining}
                            >
                              Accept
                            </button>

                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => declineRequestMutation(request._id)}
                              disabled={isPending || declining}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ACCEPTED REQS NOTIFICATONS */}
            {acceptedRequests.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BellIcon className="h-5 w-5 text-success" />
                  New Connections
                </h2>

                <div className="space-y-3">
                  {acceptedRequests.filter(Boolean).map((notification) => (
                    <div key={notification._id} className="card bg-base-200 shadow-sm">
                      <div className="card-body p-4">
                        <div className="flex items-start gap-3">
                          <div className="avatar mt-1">
                            <div className="size-10 rounded-full">
                              <img
                                className="rounded-full"
                                src={getUserAvatarSrc(notification.recipient)}
                                alt={notification.recipient?.fullName || "User"}
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{notification.recipient?.fullName || "User"}</h3>
                            <p className="text-sm my-1">
                              {(notification.recipient?.fullName || "Someone")} accepted your friend request
                            </p>
                            <p className="text-xs flex items-center opacity-70">
                              <ClockIcon className="h-3 w-3 mr-1" />
                              Recently
                            </p>
                          </div>
                          <div className="badge badge-success">
                            <MessageSquareIcon className="h-3 w-3 mr-1" />
                            New Friend
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {pendingGroupInvites.length === 0 && incomingRequests.length === 0 && acceptedRequests.length === 0 && (
              <NoNotificationsFound />
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default NotificationsPage;
