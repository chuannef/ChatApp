import { VideoIcon } from "lucide-react";

function CallButton({ handleVideoCall }) {
  return (
    <button onClick={handleVideoCall} className="btn btn-success btn-sm text-white">
      <VideoIcon className="size-6" />
    </button>
  );
}

export default CallButton;
