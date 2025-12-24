import "dotenv/config";
import mongoose from "mongoose";

import { connectDB } from "../lib/db.js";
import User from "../models/User.js";
import { pickRandomAvatarPath } from "../lib/randomAvatars.js";

function pickRandomLocalAvatar() {
  return pickRandomAvatarPath();
}

async function main() {
  await connectDB();

  const users = await User.find(
    { profilePic: { $regex: /^https?:\/\//i } },
    { _id: 1, profilePic: 1 }
  );

  if (users.length === 0) {
    console.log("No users found with external profilePic URLs.");
    await mongoose.disconnect();
    return;
  }

  const ops = users.map((u) => ({
    updateOne: {
      filter: { _id: u._id },
      update: { $set: { profilePic: pickRandomLocalAvatar() } },
    },
  }));

  const result = await User.bulkWrite(ops);
  console.log(`Updated ${result.modifiedCount} user profilePic values to local /Random_image/*.`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
