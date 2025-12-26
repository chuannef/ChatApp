import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getOutgoingFriendReqs,
  getRecommendedUsers,
  getUserFriends,
  removeFriend,
  sendFriendRequest,
} from "../lib/api";
import { CheckCircleIcon, MapPinIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import FriendCard from "../components/FriendCard";
import { capitialize } from "../lib/utils";
import { getLanguageFlag } from "../components/FriendCard";
import { getUserAvatarSrc } from "../lib/avatar";

const FriendsPage = () => {
  const queryClient = useQueryClient();
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: recommendedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { mutate: removeFriendMutation, isPending: isRemoving } = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      toast.success("Friend removed");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to remove friend");
    },
  });

  const { mutate: sendRequestMutation, isPending } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] }),
  });

  useEffect(() => {
    const outgoingIds = new Set();
    if (outgoingFriendReqs && outgoingFriendReqs.length > 0) {
      outgoingFriendReqs.forEach((req) => {
        outgoingIds.add(req.recipient._id);
      });
    }
    setOutgoingRequestsIds(outgoingIds);
  }, [outgoingFriendReqs]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-10">
        <section>
          <div className="flex items-center gap-3">
            <UsersIcon className="size-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Friends</h1>
            {friends.length > 0 && <span className="badge badge-primary">{friends.length}</span>}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : friends.length === 0 ? (
            <div className="card bg-base-200 p-8 text-center mt-6">
              <div className="flex flex-col items-center gap-4">
                <div className="size-16 rounded-full bg-base-300 flex items-center justify-center">
                  <UsersIcon className="size-8 text-base-content opacity-40" />
                </div>
                <h3 className="font-semibold text-lg">No friends yet</h3>
                <p className="text-base-content opacity-70 max-w-md">
                  Browse recommendations below to connect with language partners.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
              {friends.map((friend) => (
                <FriendCard
                  key={friend._id}
                  friend={friend}
                  onRemove={removeFriendMutation}
                  isRemoving={isRemoving}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Meet New Learners</h2>
                <p className="opacity-70">Discover perfect language exchange partners based on your profile</p>
              </div>
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : recommendedUsers.length === 0 ? (
            <div className="card bg-base-200 p-6 text-center">
              <h3 className="font-semibold text-lg mb-2">No recommendations available</h3>
              <p className="text-base-content opacity-70">Check back later for new language partners!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedUsers.filter(Boolean).map((user) => {
                const hasRequestBeenSent = outgoingRequestsIds.has(user?._id);

                return (
                  <div
                    key={user._id}
                    className="card bg-base-200 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="card-body p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="avatar">
                          <div className="size-16 rounded-full">
                            <img
                              className="rounded-full"
                              src={getUserAvatarSrc(user)}
                              alt={user?.fullName || "User"}
                            />
                          </div>
                        </div>

                        <div>
                          <h3 className="font-semibold text-lg">{user?.fullName || "User"}</h3>
                          {user.location && (
                            <div className="flex items-center text-xs opacity-70 mt-1">
                              <MapPinIcon className="size-3 mr-1" />
                              {user.location}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="badge badge-secondary w-fit">
                          {getLanguageFlag(user.nativeLanguage)}
                          Native: {capitialize(user.nativeLanguage)}
                        </span>
                        <span className="badge badge-outline w-fit">
                          {getLanguageFlag(user.learningLanguage)}
                          Learning: {capitialize(user.learningLanguage)}
                        </span>
                      </div>

                      {user.bio && <p className="text-sm opacity-70">{user.bio}</p>}

                      <button
                        className={`btn w-full mt-2 ${hasRequestBeenSent ? "btn-disabled" : "btn-primary"} `}
                        onClick={() => sendRequestMutation(user._id)}
                        disabled={hasRequestBeenSent || isPending}
                      >
                        {hasRequestBeenSent ? (
                          <>
                            <CheckCircleIcon className="size-4 mr-2" />
                            Request Sent
                          </>
                        ) : (
                          <>
                            <UserPlusIcon className="size-4 mr-2" />
                            Send Friend Request
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FriendsPage;
