import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import { getUserAvatarSrc } from "../lib/avatar";

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  CallControls,
  SpeakerLayout,
  StreamTheme,
  CallingState,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import toast from "react-hot-toast";
import PageLoader from "../components/PageLoader";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

function normalizeCallId(raw) {
  if (!raw) return "";

  const id = String(raw);

  const dmExact = /^dm-[a-f0-9]{24}-[a-f0-9]{24}$/i;
  const groupExact = /^group-[a-f0-9]{24}$/i;
  if (dmExact.test(id) || groupExact.test(id)) return id;

  const dmMatch = id.match(/dm-[a-f0-9]{24}-[a-f0-9]{24}/i);
  if (dmMatch?.[0]) return dmMatch[0];

  const groupMatch = id.match(/group-[a-f0-9]{24}/i);
  if (groupMatch?.[0]) return groupMatch[0];

  return id;
}

const CallPage = () => {
  const { id: callId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callError, setCallError] = useState("");

  const { authUser, isLoading } = useAuthUser();

  const {
    data: tokenData,
    isLoading: tokenLoading,
    isError: tokenIsError,
    error: tokenError,
  } = useQuery({
    queryKey: ["streamToken", authUser?._id],
    queryFn: getStreamToken,
    enabled: !!authUser,
    retry: false,
  });

  const normalizedCallId = normalizeCallId(callId);

  useEffect(() => {
    if (callId && normalizedCallId && callId !== normalizedCallId) {
      navigate(`/call/${normalizedCallId}`, { replace: true });
    }
  }, [callId, normalizedCallId, navigate]);

  // Block group calls (group channels use id like group-<groupId>)
  useEffect(() => {
    if (normalizedCallId?.startsWith("group-")) {
      toast.error("Group video calls are disabled");
      navigate("/groups");
    }
  }, [normalizedCallId, navigate]);

  useEffect(() => {
    if (isLoading) return;

    if (!normalizedCallId) {
      setCallError("Missing call id");
      setIsConnecting(false);
      return;
    }

    if (!authUser) {
      setCallError("Please log in to join the call");
      setIsConnecting(false);
    }
  }, [isLoading, authUser, normalizedCallId]);

  useEffect(() => {
    const initCall = async () => {
      if (!authUser || !normalizedCallId) return;

      if (tokenLoading) return;

      if (tokenIsError) {
        const msg = tokenError?.response?.data?.message || tokenError?.message || "Failed to load Stream token";
        setCallError(msg);
        setIsConnecting(false);
        return;
      }

      if (!tokenData?.token) {
        setCallError("Stream token missing from server response");
        setIsConnecting(false);
        return;
      }

      if (!STREAM_API_KEY) {
        setCallError("Missing Stream API key (VITE_STREAM_API_KEY)");
        setIsConnecting(false);
        return;
      }

      if (normalizedCallId.startsWith("group-")) {
        setIsConnecting(false);
        return;
      }

      try {
        console.log("Initializing Stream video client...");

        const user = {
          id: authUser._id,
          name: authUser.fullName,
          image: getUserAvatarSrc(authUser),
        };

        const videoClient = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user,
          token: tokenData.token,
        });

        const callInstance = videoClient.call("default", normalizedCallId);

        await callInstance.join({ create: true });

        console.log("Joined call successfully");

        setClient(videoClient);
        setCall(callInstance);
      } catch (error) {
        console.error("Error joining call:", error);
        const msg = error?.message || "Could not join the call. Please try again.";
        setCallError(msg);
        toast.error(msg);
      } finally {
        setIsConnecting(false);
      }
    };

    initCall();
  }, [tokenData?.token, tokenLoading, tokenIsError, tokenError, authUser, normalizedCallId]);

  if (isLoading || isConnecting) return <PageLoader />;

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <div className="relative">
        {client && call ? (
          <StreamVideo client={client}>
            <StreamCall call={call}>
              <CallContent />
            </StreamCall>
          </StreamVideo>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>{callError || "Could not initialize call. Please refresh or try again later."}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const CallContent = () => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();

  const navigate = useNavigate();

  if (callingState === CallingState.LEFT) return navigate("/");

  return (
    <StreamTheme>
      <SpeakerLayout />
      <CallControls />
    </StreamTheme>
  );
};

export default CallPage;
