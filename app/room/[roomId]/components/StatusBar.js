"use client";

const StatusBar = ({ isReady, remoteEmail }) => {
  return (
    <div className="absolute top-4 left-4 bg-black bg-opacity-50 px-4 py-2 rounded-lg">
      <div className="flex items-center gap-2 text-white text-sm">
        <div
          className={`w-2 h-2 rounded-full ${
            isReady ? "bg-green-500" : "bg-yellow-500"
          }`}
        />
        <span>{isReady ? "Connected" : "Setting up..."}</span>
      </div>

      {remoteEmail && (
        <div className="text-white text-xs mt-1">{remoteEmail}</div>
      )}
    </div>
  );
};

export default StatusBar;
