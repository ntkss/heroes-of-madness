"use client";

import React from "react";
import styles from "./styles.module.css";

interface CRTOverlayProps {
  children: React.ReactNode;
  isShaking?: boolean;
}

export default function CRTOverlay({
  children,
  isShaking = false,
}: CRTOverlayProps) {
  return (
    <div
      className={`${styles.crtScreen} ${styles.crtFlicker} ${styles.crtScreenOn} ${
        isShaking ? styles.shakeScreen : ""
      }`}
    >
      {/* Background CRT scanlines */}
      <div className={styles.crtScanlines} />

      {/* Screen vignette inner shadow */}
      <div className={styles.vignette} />

      <div className={styles.contentContainer}>{children}</div>
    </div>
  );
}
