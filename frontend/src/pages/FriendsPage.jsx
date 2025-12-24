import { useQuery } from "@tanstack/react-query";
import { getUserFriends } from "../lib/api";
import { UsersIcon } from "lucide-react";
import FriendCard from "../components/FriendCard";

const FriendsPage = () => {
  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <UsersIcon className="size-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Friends</h1>
          {friends.length > 0 && (
            <span className="badge badge-primary">{friends.length}</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : friends.length === 0 ? (
          <div className="card bg-base-200 p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="size-16 rounded-full bg-base-300 flex items-center justify-center">
                <UsersIcon className="size-8 text-base-content opacity-40" />
              </div>
              <h3 className="font-semibold text-lg">No friends yet</h3>
              <p className="text-base-content opacity-70 max-w-md">
                Go to the Home page to discover and connect with language partners!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {friends.map((friend) => (
              <FriendCard key={friend._id} friend={friend} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
