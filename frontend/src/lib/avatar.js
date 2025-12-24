import { RANDOM_AVATAR_FILES, pickRandomAvatarFile, RANDOM_AVATAR_PREFIX } from "./randomAvatars";

function hashString(input) {
  // djb2
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

function pickDeterministicRandomAvatar(seed) {
  const list = Array.isArray(RANDOM_AVATAR_FILES) ? RANDOM_AVATAR_FILES : [];
  if (list.length === 0) return "";
  const idx = hashString(seed) % list.length;
  return `${RANDOM_AVATAR_PREFIX}${list[idx]}`;
}

export function pickRandomAvatar() {
  return `${RANDOM_AVATAR_PREFIX}${pickRandomAvatarFile()}`;
}

export function getUserAvatarSrc(user) {
  const src = user?.profilePic;

  if (typeof src === "string" && src.trim()) {
    // allow uploaded (base64), blob URLs, and local paths
    if (src.startsWith("data:image/")) return src;
    if (src.startsWith("blob:")) return src;

    // if already local random avatar, keep
    if (src.startsWith(RANDOM_AVATAR_PREFIX)) return src;

    // if it's not an external URL, keep (e.g. relative local path)
    if (!/^https?:\/\//i.test(src)) return src;
  }

  const seed = String(user?._id || user?.email || user?.fullName || "");
  return pickDeterministicRandomAvatar(seed || "fallback");
}
