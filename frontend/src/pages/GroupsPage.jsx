import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { 
  Users2Icon, 
  PlusIcon, 
  XIcon, 
  UsersIcon,
  LogOutIcon,
  TrashIcon,
  UserPlusIcon,
  CheckIcon
} from "lucide-react";
import { 
  getMyGroups, 
  getAvailableGroups, 
  createGroup, 
  joinGroup, 
  leaveGroup, 
  deleteGroup,
  getUserFriends 
} from "../lib/api";
import useAuthUser from "../hooks/useAuthUser";
import { getUserAvatarSrc } from "../lib/avatar";

const GroupsPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("my-groups");
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();

  // Fetch my groups
  const { data: myGroups = [], isLoading: loadingMyGroups } = useQuery({
    queryKey: ["myGroups"],
    queryFn: getMyGroups,
    enabled: activeTab === "my-groups",
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch available groups
  const { data: availableGroups = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ["availableGroups"],
    queryFn: getAvailableGroups,
    enabled: activeTab === "available",
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Join group mutation
  const { mutate: joinGroupMutation, isPending: isJoining } = useMutation({
    mutationFn: joinGroup,
    onSuccess: () => {
      toast.success("Join request sent");
      queryClient.invalidateQueries({ queryKey: ["myGroups"] });
      queryClient.invalidateQueries({ queryKey: ["availableGroups"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to send join request");
    },
  });

  // Leave group mutation
  const { mutate: leaveGroupMutation, isPending: isLeaving } = useMutation({
    mutationFn: leaveGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myGroups"] });
      queryClient.invalidateQueries({ queryKey: ["availableGroups"] });
    },
  });

  // Delete group mutation
  const { mutate: deleteGroupMutation, isPending: isDeleting } = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myGroups"] });
      queryClient.invalidateQueries({ queryKey: ["availableGroups"] });
    },
  });

  const handleLeaveGroup = (groupId) => {
    if (confirm("Are you sure you want to leave this group?")) {
      leaveGroupMutation(groupId);
    }
  };

  const handleDeleteGroup = (groupId) => {
    if (confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      deleteGroupMutation(groupId);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users2Icon className="size-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Groups</h1>
          </div>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
          >
            <PlusIcon className="size-4 mr-1" />
            Create Group
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed w-fit">
          <button 
            className={`tab ${activeTab === "my-groups" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("my-groups")}
          >
            My Groups ({myGroups.length})
          </button>
          <button 
            className={`tab ${activeTab === "available" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("available")}
          >
            Available Groups ({availableGroups.length})
          </button>
        </div>

        {/* My Groups Tab */}
        {activeTab === "my-groups" && (
          <div>
            {loadingMyGroups ? (
              <div className="flex justify-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : myGroups.length === 0 ? (
              <EmptyState 
                message="You haven't joined any groups yet" 
                subMessage="Create a new group or join an existing one!"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myGroups.map((group) => (
                  <GroupCard 
                    key={group._id} 
                    group={group} 
                    isMyGroup={true}
                    isAdmin={group.admin._id === authUser._id}
                    onLeave={() => handleLeaveGroup(group._id)}
                    onDelete={() => handleDeleteGroup(group._id)}
                    isLeaving={isLeaving}
                    isDeleting={isDeleting}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Available Groups Tab */}
        {activeTab === "available" && (
          <div>
            {loadingAvailable ? (
              <div className="flex justify-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : availableGroups.length === 0 ? (
              <EmptyState 
                message="No available groups to join" 
                subMessage="All groups are either private or you're already a member!"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableGroups.map((group) => (
                  <GroupCard 
                    key={group._id} 
                    group={group} 
                    isMyGroup={false}
                    onJoin={() => joinGroupMutation(group._id)}
                    isJoining={isJoining}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};

// Empty State Component
const EmptyState = ({ message, subMessage }) => (
  <div className="card bg-base-200 p-8 text-center">
    <div className="flex flex-col items-center gap-4">
      <div className="size-16 rounded-full bg-base-300 flex items-center justify-center">
        <Users2Icon className="size-8 text-base-content opacity-40" />
      </div>
      <h3 className="font-semibold text-lg">{message}</h3>
      <p className="text-base-content opacity-70 max-w-md">{subMessage}</p>
    </div>
  </div>
);

// Group Card Component
const GroupCard = ({ 
  group, 
  isMyGroup, 
  isAdmin = false,
  onLeave, 
  onDelete, 
  onJoin,
  isLeaving,
  isDeleting,
  isJoining 
}) => {
  return (
    <div className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-12">
                <span className="text-xl">{group.name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold">{group.name}</h3>
              <p className="text-sm text-base-content/70">
                <UsersIcon className="size-3 inline mr-1" />
                {group.members.length} members
              </p>
            </div>
          </div>
          {isAdmin && (
            <span className="badge badge-primary badge-sm">Admin</span>
          )}
        </div>

        {group.description && (
          <p className="text-sm text-base-content/80 mt-2 line-clamp-2">
            {group.description}
          </p>
        )}

        {/* Member Avatars */}
        <div className="flex -space-x-2 mt-3">
          {group.members.slice(0, 5).map((member) => (
            <div key={member._id} className="avatar border-2 border-base-200 rounded-full">
              <div className="w-8 rounded-full">
                <img 
                  src={getUserAvatarSrc(member)} 
                  alt={member.fullName} 
                />
              </div>
            </div>
          ))}
          {group.members.length > 5 && (
            <div className="avatar placeholder border-2 border-base-200 rounded-full">
              <div className="w-8 rounded-full bg-base-300">
                <span className="text-xs">+{group.members.length - 5}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card-actions justify-end mt-4">
          {isMyGroup && (
            <Link className="btn btn-primary btn-sm" to={`/groups/${group._id}`}>Open</Link>
          )}
          {isMyGroup ? (
            <>
              {isAdmin ? (
                <button 
                  className="btn btn-error btn-sm"
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <>
                      <TrashIcon className="size-4" />
                      Delete
                    </>
                  )}
                </button>
              ) : (
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={onLeave}
                  disabled={isLeaving}
                >
                  {isLeaving ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <>
                      <LogOutIcon className="size-4" />
                      Leave
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <button 
              className="btn btn-primary btn-sm"
              onClick={onJoin}
              disabled={isJoining || group?.hasPendingJoinRequest}
            >
              {isJoining ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <>
                  <UserPlusIcon className="size-4" />
                  {group?.hasPendingJoinRequest ? "Requested" : "Request to join"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Create Group Modal Component
const CreateGroupModal = ({ onClose }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const queryClient = useQueryClient();

  // Fetch friends to select as members
  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { mutate: createGroupMutation, isPending: isCreating } = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myGroups"] });
      queryClient.invalidateQueries({ queryKey: ["availableGroups"] });
      onClose();
    },
  });

  const toggleMember = (friendId) => {
    if (selectedMembers.includes(friendId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== friendId));
    } else {
      setSelectedMembers([...selectedMembers, friendId]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedMembers.length < 2) {
      alert("Please select at least 2 friends to create a group (minimum 3 members including you)");
      return;
    }
    createGroupMutation({
      name,
      description,
      memberIds: selectedMembers,
    });
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <button 
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </button>
        
        <h3 className="font-bold text-lg mb-4">Create New Group</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Group Name *</span>
            </label>
            <input
              type="text"
              placeholder="Enter group name"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              placeholder="What is this group about?"
              className="textarea textarea-bordered w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Select Members */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">
                Select Members * (min 2 friends)
              </span>
              <span className="label-text-alt">
                {selectedMembers.length} selected
              </span>
            </label>
            
            {loadingFriends ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner"></span>
              </div>
            ) : friends.length === 0 ? (
              <div className="alert alert-warning">
                <span>You need friends to create a group. Add some friends first!</span>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
                {friends.map((friend) => (
                  <label 
                    key={friend._id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-base-200 transition-colors ${
                      selectedMembers.includes(friend._id) ? "bg-primary/10" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selectedMembers.includes(friend._id)}
                      onChange={() => toggleMember(friend._id)}
                    />
                    <div className="avatar">
                      <div className="w-8 rounded-full">
                        <img 
                          src={getUserAvatarSrc(friend)} 
                          alt={friend.fullName} 
                        />
                      </div>
                    </div>
                    <span className="font-medium">{friend.fullName}</span>
                    {selectedMembers.includes(friend._id) && (
                      <CheckIcon className="size-4 text-primary ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="alert alert-info">
            <span className="text-sm">
              A group needs at least 3 members (including you). Select at least 2 friends.
            </span>
          </div>

          {/* Actions */}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isCreating || selectedMembers.length < 2 || !name.trim()}
            >
              {isCreating ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <>
                  <PlusIcon className="size-4" />
                  Create Group
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose}></div>
    </div>
  );
};

export default GroupsPage;
