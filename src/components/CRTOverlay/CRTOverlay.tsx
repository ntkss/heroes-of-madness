"use client";

import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";

interface CRTOverlayProps {
  children: React.ReactNode;
  isShaking?: boolean;
}

export default function CRTOverlay({
  children,
  isShaking = false,
}: CRTOverlayProps) {
  const [powerOn, setPowerOn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPowerOn(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`${styles.crtScreen} ${
        powerOn
          ? `${styles.crtFlicker} ${styles.crtScreenOn}`
          : styles.crtScreenOff
      } ${isShaking ? styles.shakeScreen : ""}`}
    >
      {/* Background CRT scanlines */}
      <div className={styles.crtScanlines} />

      {/* Screen vignette inner shadow */}
      <div className={styles.vignette} />

      <div className={styles.contentContainer}>{children}</div>
    </div>
  );
}
