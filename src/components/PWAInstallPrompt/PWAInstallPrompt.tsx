"use client";

import React, { useState, useEffect } from "react";
import {
  registerServiceWorker,
  requestNotificationPermission,
  getNotificationPermissionState,
  sendLocalNotification,
  notifyMuster,
  initMusterScheduler,
  NotificationPermissionState,
} from "@/utils/notifications";
import { playBeep, playCoin } from "@/utils/audio";
import styles from "./styles.module.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PWAInstallPrompt({
  senderName,
}: {
  senderName?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [notifState, setNotifState] =
    useState<NotificationPermissionState>("default");
  const [isMusterSending, setIsMusterSending] = useState(false);

  useEffect(() => {
    // 1. Initialize Service Worker & Scheduler
    registerServiceWorker();
    const cleanupScheduler = initMusterScheduler();

    // 2. Check Device & Permissions asynchronously to prevent cascading renders
    const timer = setTimeout(() => {
      setNotifState(getNotificationPermissionState());

      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true;
      setIsStandalone(Boolean(isStandaloneMode));

      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice =
        /iphone|ipad|ipod/.test(userAgent) ||
        (window.navigator.platform === "MacIntel" &&
          window.navigator.maxTouchPoints > 1);
      setIsIOS(Boolean(isIOSDevice));
    }, 0);

    // 3. Capture Android / Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      cleanupScheduler();
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  // Handle PWA installation
  const handleInstallClick = async () => {
    playBeep(440, 0.1, "sine");

    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        playCoin();
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } else {
      alert(
        "สามารถติดตั้งแอปได้โดยแตะที่เมนูการตั้งค่าของเบราว์เซอร์ แล้วเลือก 'ติดตั้งแอป' (Install App) หรือ 'เพิ่มไปยังหน้าจอโฮม'",
      );
    }
  };

  // Handle Notification Toggle
  const handleNotificationClick = async () => {
    if (notifState === "granted") {
      playCoin();
      await sendLocalNotification("🔔 ระบบแจ้งเตือนเปิดใช้งานอยู่แล้ว", {
        body: "คุณจะได้รับการแจ้งเตือนผลการสุ่มทีม และแจ้งเตือนระดมพลเวลา 12:30 และ 18:00 น.",
      });
    } else {
      const granted = await requestNotificationPermission();
      setNotifState(granted ? "granted" : "denied");
    }
  };

  // Handle Manual Call-to-Arms (เรียกระดมพล)
  const handleCallToArms = async () => {
    if (isMusterSending) return;
    setIsMusterSending(true);
    playCoin();
    try {
      await notifyMuster("manual", senderName);
      playBeep(523, 0.2, "sine");
      alert(
        `📢 เรียกระดมพลสำเร็จ! ส่งสัญญาณเตือนเข้าเครื่องผู้เล่น และแจ้งเตือนเข้ากลุ่ม LINE เรียบร้อยแล้ว`,
      );
    } catch (err) {
      console.error("Muster error:", err);
    } finally {
      setIsMusterSending(false);
    }
  };

  return (
    <>
      <div className={styles.container}>
        {/* 1. Install PWA Button (Visible if not in standalone mode) */}
        {!isStandalone && (
          <button
            type="button"
            onClick={handleInstallClick}
            className={`${styles.actionBtn} ${styles.installBtn}`}
            title="ติดตั้งสัญลักษณ์แอป Heroes of Madness ลงหน้าจอโฮม"
          >
            <span>📲 ติดตั้งแอป (PWA)</span>
          </button>
        )}

        {/* 2. Notification Control */}
        <button
          type="button"
          onClick={handleNotificationClick}
          className={`${styles.actionBtn} ${
            notifState === "granted"
              ? styles.notifyBtnActive
              : styles.notifyBtnInactive
          }`}
          title="เปิด/ตรวจสอบการแจ้งเตือนสุ่มทีมและเรียกระดมพล"
        >
          <span>
            {notifState === "granted"
              ? "🔔 แจ้งเตือน: เปิดแล้ว"
              : "🔕 เปิดแจ้งเตือน"}
          </span>
        </button>

        {/* 3. Call to Arms Button (เรียกระดมพล) */}
        <button
          type="button"
          onClick={handleCallToArms}
          disabled={isMusterSending}
          className={`${styles.actionBtn} ${styles.musterBtn}`}
          title="เรียกระดมพลผู้เล่นทุกคนเข้าเล่นเกมเดี๋ยวนี้ (ส่งแจ้งเตือนเข้าเครื่อง & กลุ่ม LINE)"
        >
          <span>
            {isMusterSending ? "⏳ กำลังระดมพล..." : "📢 เรียกระดมพล"}
          </span>
        </button>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIOSModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <span>📲</span> ติดตั้งลงหน้าจอโฮม (iOS)
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div className={styles.stepList}>
              <div className={styles.stepItem}>
                <span className={styles.stepNumber}>1</span>
                <span className={styles.stepText}>
                  แตะปุ่ม <strong>แชร์ ⎋ (Share)</strong> ที่แถบเมนูด้านล่างของ
                  Safari
                </span>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepNumber}>2</span>
                <span className={styles.stepText}>
                  เลื่อนลงมาแล้วแตะที่{" "}
                  <strong>➕ เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong>
                </span>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepNumber}>3</span>
                <span className={styles.stepText}>
                  แตะ <strong>เพิ่ม (Add)</strong> ที่มุมขวาบน
                  เพื่อเปิดใช้งานแบบแอปเต็มจอและรับการแจ้งเตือน
                </span>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className={styles.confirmBtn}
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
