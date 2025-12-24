export const RANDOM_AVATAR_FILES = [
  "f1.png",
  "f2.png",
  "f3.png",
  "f4.png",
  "f5.png",
  "f6.png",
  "f7.png",
  "f8.png",
  "f9.png",
  "f10.png",
  "f17.png",
];

export const RANDOM_AVATAR_PREFIX = "/Random_image/";

export function pickRandomAvatarFile() {
  const idx = Math.floor(Math.random() * RANDOM_AVATAR_FILES.length);
  return RANDOM_AVATAR_FILES[idx];
}

export function pickRandomAvatarPath() {
  return `${RANDOM_AVATAR_PREFIX}${pickRandomAvatarFile()}`;
}
