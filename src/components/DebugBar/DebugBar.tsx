"use client";

import React, { useState, useEffect } from "react";
import { isFirebaseConfigured } from "@/utils/firebase";
import pkg from "../../../package.json";
import styles from "./styles.module.css";

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
    <div className={styles.wrapper}>
      {/* Expanded Diagnostics Panel */}
      {isOpen && (
        <div className={`${styles.panel} ${styles.animateScaleUp}`}>
          {/* Cyber scanlines overlay on details */}
          <div className={styles.scanlines} />

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.indicatorContainer}>
              <span className={styles.statusDotActive} />
              <span className={styles.title}>CABINET SYSTEM LOGS</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className={styles.closeBtn}
            >
              [X]
            </button>
          </div>

          {/* Details list */}
          <div className={styles.detailsList}>
            {/* Version Block */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>SYSTEM BUILD</span>
              <span className={styles.detailValue}>{buildVersion}</span>
            </div>

            {/* Engine Frameworks */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>ENGINES</span>
              <span className={styles.detailValueHighlight}>
                Next {nextVersion} / React {reactVersion}
              </span>
            </div>

            {/* DB Status */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>DATABASE</span>
              {isFirebaseConfigured ? (
                <span className={styles.detailValueDbOnline}>
                  ONLINE (FIRESTORE)
                </span>
              ) : (
                <span className={styles.detailValueDbOffline}>
                  OFFLINE (LOCAL)
                </span>
              )}
            </div>

            {/* Network status */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>NET CONNECTION</span>
              {isOnline ? (
                <span className={styles.detailValueNetOnline}>ONLINE</span>
              ) : (
                <span className={styles.detailValueDbOffline}>OFFLINE</span>
              )}
            </div>

            {/* OS & Browser */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>CLIENT PLATFORM</span>
              <span className={styles.detailValue}>
                {clientInfo.os} ({clientInfo.browser})
              </span>
            </div>

            {/* Viewport */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>VIEWPORT SIZE</span>
              <span className={styles.detailValue}>
                {viewport.width} x {viewport.height}
              </span>
            </div>

            {/* Resolution */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>SCREEN RESOLUTION</span>
              <span className={styles.detailValue}>
                {screenRes.width} x {screenRes.height}
              </span>
            </div>

            {/* System Hardware */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>HW SPEC</span>
              <span className={styles.detailValue}>
                {hardware.cores} / {hardware.memory}
              </span>
            </div>

            {/* Local time */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>CABINET TIME</span>
              <span className={styles.detailValueTime}>{localTime}</span>
            </div>

            {/* Mode */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>EXECUTION ENV</span>
              <span className={styles.detailValueEnv}>
                {process.env.NODE_ENV}
              </span>
            </div>
          </div>

          {/* Dev Utils Actions */}
          <div className={styles.actionsContainer}>
            <button onClick={handleClearHistory} className={styles.purgeBtn}>
              PURGE LOCAL RECORDS
            </button>
          </div>
        </div>
      )}

      {/* Main Debug Pill Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${styles.toggleBtn} ${
          isOpen ? styles.toggleBtnActive : styles.toggleBtnInactive
        }`}
      >
        <span className={styles.btnLabel}>
          <span
            className={
              isFirebaseConfigured
                ? styles.statusDotYellow
                : styles.statusDotRed
            }
          />
          SYSTEM MONITOR {buildVersion}
        </span>
        <span className={styles.btnSublabel}>
          {isOpen ? "▼ CLOSE" : "▲ INFO"}
        </span>
      </button>
    </div>
  );
}
