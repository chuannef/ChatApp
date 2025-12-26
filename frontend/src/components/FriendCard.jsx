import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LANGUAGE_TO_FLAG } from "../constants";
import { getUserAvatarSrc } from "../lib/avatar";
import { getDmMessages } from "../lib/api";

const FriendCard = ({ friend, onRemove, isRemoving = false }) => {
  const queryClient = useQueryClient();

  const prefetchDm = () => {
    const targetId = friend?._id;
    if (!targetId) return;

    queryClient.prefetchQuery({
      queryKey: ["dmMessages", targetId],
      queryFn: () => getDmMessages(targetId),
      staleTime: 30 * 1000,
    });
  };

  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar">
            <div className="size-12 rounded-full">
              <img
                className="rounded-full"
                src={getUserAvatarSrc(friend)}
                alt={friend?.fullName || "User"}
              />
            </div>
          </div>
          <h3 className="font-semibold truncate">{friend?.fullName || "User"}</h3>
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <span className="badge badge-secondary text-xs w-fit">
            {getLanguageFlag(friend.nativeLanguage)}
            Native: {friend.nativeLanguage}
          </span>
          <span className="badge badge-outline text-xs w-fit">
            {getLanguageFlag(friend.learningLanguage)}
            Learning: {friend.learningLanguage}
          </span>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/chat/${friend?._id || ""}`}
            className="btn btn-outline flex-1"
            aria-disabled={!friend?._id}
            onMouseEnter={prefetchDm}
            onFocus={prefetchDm}
          >
            Message
          </Link>

          {typeof onRemove === "function" && (
            <button
              type="button"
              className="btn btn-outline btn-error"
              onClick={() => onRemove(friend?._id)}
              disabled={!friend?._id || isRemoving}
              title="Remove friend"
            >
              {isRemoving ? <span className="loading loading-spinner loading-xs" /> : "Remove"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default FriendCard;

export function getLanguageFlag(language) {
  if (!language) return null;

  const langLower = language.toLowerCase();
  const countryCode = LANGUAGE_TO_FLAG[langLower];

  if (countryCode) {
    return (
      <img
        src={`https://flagcdn.com/24x18/${countryCode}.png`}
        alt={`${langLower} flag`}
        className="h-3 mr-1 inline-block"
      />
    );
  }
  return null;
}
