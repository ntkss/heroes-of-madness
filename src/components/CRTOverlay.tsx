"use client";

import React, { useEffect, useState } from "react";

interface CRTOverlayProps {
  children: React.ReactNode;
  isShaking?: boolean;
}

export default function CRTOverlay({ children, isShaking = false }: CRTOverlayProps) {
  const [powerOn, setPowerOn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPowerOn(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className={`crt-screen min-h-screen flex flex-col transition-all duration-500 ${
        powerOn ? "crt-flicker scale-100 opacity-100" : "scale-95 opacity-0 bg-black"
      } ${isShaking ? "shake-screen" : ""}`}
    >
      {/* Background CRT scanlines */}
      <div className="crt-scanlines" />
      
      {/* Screen vignette inner shadow */}
      <div 
        className="pointer-events-none absolute inset-0 z-50 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]"
        style={{
          background: "radial-gradient(circle, transparent 70%, rgba(0,0,0,0.45) 100%)"
        }}
      />
      
      <div className="relative z-10 flex flex-col flex-1">
        {children}
      </div>
    </div>
  );
}
