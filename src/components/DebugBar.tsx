"use client";

import React, { useState, useEffect } from "react";
import { isFirebaseConfigured } from "@/utils/firebase";
import pkg from "../../package.json";

export default function DebugBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== "undefined") {
      return navigator.onLine;
    }
    return true;
  });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [screenRes, setScreenRes] = useState({ width: 0, height: 0 });
  const [clientInfo, setClientInfo] = useState({
    os: "Detecting...",
    browser: "Detecting...",
  });
  const [localTime, setLocalTime] = useState("");
  const [hardware, setHardware] = useState({ cores: "N/A", memory: "N/A" });

  useEffect(() => {
    // 1. Online/Offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 2. Viewport & Screen Dimensions
    const updateDimensions = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setScreenRes({
        width: window.screen.width,
        height: window.screen.height,
      });
    };
    window.addEventListener("resize", updateDimensions);

    // 3. User Agent / Client Details
    const ua = window.navigator.userAgent;
    let os = "Other OS";
    if (ua.indexOf("Win") !== -1) os = "Windows";
    else if (ua.indexOf("Mac") !== -1) os = "macOS";
    else if (ua.indexOf("Linux") !== -1) os = "Linux";
    else if (ua.indexOf("Android") !== -1) os = "Android";
    else if (ua.indexOf("like Mac") !== -1) os = "iOS";

    let browser = "Other Browser";
    if (ua.indexOf("Chrome") !== -1 && ua.indexOf("Edg") === -1)
      browser = "Chrome";
    else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1)
      browser = "Safari";
    else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
    else if (ua.indexOf("Edg") !== -1) browser = "Edge";
    else if (
      ua.indexOf("MSIE") !== -1 ||
      !!(document as Document & { documentMode?: unknown }).documentMode
    )
      browser = "IE";

    // 4. Hardware details
    const cores = navigator.hardwareConcurrency
      ? `${navigator.hardwareConcurrency} Cores`
      : "N/A";
    const devMemory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    const memory = devMemory ? `${devMemory} GB RAM` : "N/A";

    // 5. Clock ticker
    const tick = () => {
      const now = new Date();
      setLocalTime(now.toTimeString().split(" ")[0]);
    };
    const clockInterval = setInterval(tick, 1000);

    // Defer synchronous state updates to avoid React cascading renders
    const initTimer = setTimeout(() => {
      updateDimensions();
      setClientInfo({ os, browser });
      setHardware({ cores, memory });
      tick();
    }, 0);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("resize", updateDimensions);
      clearInterval(clockInterval);
      clearTimeout(initTimer);
    };
  }, []);

  const handleClearHistory = () => {
    if (
      confirm(
        "⚠️ DESTROY DATABASE HISTORY?\nThis will clear LocalStorage match history logs and cached player profiles. Proceed?",
      )
    ) {
      localStorage.removeItem("mlbb_generator_matches");
      localStorage.removeItem("mlbb_generator_players");
      window.location.reload();
    }
  };

  const nextVersion = pkg.dependencies.next?.replace("^", "") || "16.2.6";
  const reactVersion = pkg.dependencies.react?.replace("^", "") || "19.2.4";

  const gitHash = process.env.NEXT_PUBLIC_GIT_COMMIT_HASH || "unknown";
  const buildVersion =
    gitHash !== "unknown"
      ? `${pkg.version || "0.1.0"}-${gitHash}`
      : `v${pkg.version || "0.1.0"}`;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 font-tech select-none">
      {/* Expanded Diagnostics Panel */}
      {isOpen && (
        <div className="w-80 bg-slate-950/95 backdrop-blur-md border-2 border-neon-blue shadow-[0_0_25px_rgba(0,210,255,0.35)] relative overflow-hidden flex flex-col p-4 animate-scaleUp">
          {/* Cyber scanlines overlay on details */}
          <div className="absolute inset-0 stripes-blue opacity-5 pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-neon-blue animate-pulse shadow-[0_0_8px_var(--color-neon-blue)]" />
              <span className="font-pixel text-[10px] text-neon-yellow glow-yellow tracking-widest uppercase">
                CABINET SYSTEM LOGS
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neon-red hover:text-white font-pixel text-[10px] cursor-pointer transition-colors"
            >
              [X]
            </button>
          </div>

          {/* Details list */}
          <div className="flex flex-col gap-2.5 text-[11px] text-[#a0a0c0]">
            {/* Version Block */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                SYSTEM BUILD
              </span>
              <span className="text-white font-bold">{buildVersion}</span>
            </div>

            {/* Engine Frameworks */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                ENGINES
              </span>
              <span className="text-neon-blue font-bold">
                Next {nextVersion} / React {reactVersion}
              </span>
            </div>

            {/* DB Status */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                DATABASE
              </span>
              {isFirebaseConfigured ? (
                <span className="text-neon-yellow glow-yellow font-bold animate-pulse">
                  ONLINE (FIRESTORE)
                </span>
              ) : (
                <span className="text-neon-red glow-red font-bold">
                  OFFLINE (LOCAL)
                </span>
              )}
            </div>

            {/* Network status */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                NET CONNECTION
              </span>
              {isOnline ? (
                <span className="text-green-400 font-bold">ONLINE</span>
              ) : (
                <span className="text-neon-red glow-red font-bold animate-pulse">
                  OFFLINE
                </span>
              )}
            </div>

            {/* OS & Browser */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                CLIENT PLATFORM
              </span>
              <span className="text-white">
                {clientInfo.os} ({clientInfo.browser})
              </span>
            </div>

            {/* Viewport */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                VIEWPORT SIZE
              </span>
              <span className="text-white">
                {viewport.width} x {viewport.height}
              </span>
            </div>

            {/* Resolution */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                SCREEN RESOLUTION
              </span>
              <span className="text-white">
                {screenRes.width} x {screenRes.height}
              </span>
            </div>

            {/* System Hardware */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                HW SPEC
              </span>
              <span className="text-white">
                {hardware.cores} / {hardware.memory}
              </span>
            </div>

            {/* Local time */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                CABINET TIME
              </span>
              <span className="text-neon-yellow font-pixel text-[9px]">
                {localTime}
              </span>
            </div>

            {/* Mode */}
            <div className="flex justify-between border-b border-slate-900 pb-1.5">
              <span className="uppercase text-slate-500 font-bold">
                EXECUTION ENV
              </span>
              <span className="text-neon-blue capitalize">
                {process.env.NODE_ENV}
              </span>
            </div>
          </div>

          {/* Dev Utils Actions */}
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={handleClearHistory}
              className="w-full border border-neon-red/50 bg-neon-red/10 text-neon-red hover:bg-neon-red/20 hover:border-neon-red py-1.5 px-3 font-pixel text-[8px] tracking-wider transition-all duration-200 cursor-pointer text-center uppercase"
            >
              PURGE LOCAL RECORDS
            </button>
          </div>
        </div>
      )}

      {/* Main Debug Pill Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 bg-slate-950/90 hover:bg-slate-900 border-2 py-1.5 px-3 rounded-none shadow-[0_0_12px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-pointer ${
          isOpen
            ? "border-neon-yellow text-neon-yellow glow-yellow"
            : "border-neon-blue text-neon-blue hover:border-neon-yellow hover:text-neon-yellow hover:glow-yellow"
        }`}
      >
        <span className="font-pixel text-[9px] tracking-wider flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              isFirebaseConfigured
                ? "bg-neon-yellow animate-pulse"
                : "bg-neon-red"
            }`}
          />
          SYSTEM MONITOR {buildVersion}
        </span>
        <span className="font-pixel text-[7px] text-slate-400">
          {isOpen ? "▼ CLOSE" : "▲ INFO"}
        </span>
      </button>
    </div>
  );
}
