import { StreamClient } from "@stream-io/node-sdk";
import "dotenv/config";

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error("Stream API key or Secret is missing");
}

const streamClient = apiKey && apiSecret ? new StreamClient(apiKey, apiSecret) : null;

export const upsertStreamUser = async (userData) => {
  try {
    if (!streamClient) {
      throw new Error("Stream API key/secret not configured");
    }

    await streamClient.upsertUsers([userData]);
    return userData;
  } catch (error) {
    console.error("Error upserting Stream user:", error);
  }
};

// Stream Video SDK expects a Stream user JWT (NOT a Stream Chat client token).
export const generateStreamToken = (userId) => {
  try {
    if (!streamClient) {
      throw new Error("Stream API key/secret not configured");
    }

    const userIdStr = userId.toString();
    return streamClient.createToken(userIdStr);
  } catch (error) {
    console.error("Error generating Stream token:", error);
  }
};
