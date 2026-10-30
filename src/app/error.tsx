"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Heroes of Madness runtime error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050508] text-white p-6 gap-6">
      <div className="text-center max-w-md">
        <h2 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 mb-4">
          SYSTEM ERROR
        </h2>
        <p className="text-sm text-slate-400 font-mono mb-2">
          ⚠️ Something went wrong during the match draft.
        </p>
        <p className="text-[10px] text-slate-600 font-mono break-all">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        onClick={() => unstable_retry()}
        className="border-2 border-yellow-400 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400 hover:text-black px-6 py-3 font-bold text-sm tracking-wider uppercase transition-all duration-200 cursor-pointer"
      >
        ⚡ RETRY
      </button>
    </div>
  );
}
