import React, { useState } from "react";
import { Copy, Check, X } from "lucide-react";

const RoomInfoCard = ({ roomId, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute bottom-24 right-6 bg-white rounded-xl p-5 shadow-2xl w-72 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-900 text-base">Meeting details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-gray-600 mb-4 leading-relaxed">
        Send this meeting ID to people you want to join.
      </p>

      <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 p-3 rounded-lg group">
        <span className="text-sm font-medium text-gray-700 truncate select-all">
          {roomId}
        </span>
        <button
          onClick={copyToClipboard}
          className="flex-shrink-0 p-2 bg-white border border-gray-200 rounded-md hover:border-violet-500 hover:text-violet-600 transition-all shadow-sm active:scale-95"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {copied && (
        <p className="text-[10px] text-green-600 font-semibold mt-2 animate-pulse">
          Copied to clipboard!
        </p>
      )}
    </div>
  );
};

export default RoomInfoCard;
