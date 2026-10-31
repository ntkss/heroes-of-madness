"use client";

import { playBeep, playCoin } from "./audio";

// Check notification permission state
export type NotificationPermissionState =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

// Register PWA Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log(
      "[PWA] Service Worker registered successfully with scope:",
      registration.scope,
    );
    return registration;
  } catch (error) {
    console.error("[PWA] Service Worker registration failed:", error);
    return null;
  }
}

// Request Notification Permission (User Action)
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    alert("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ System Notification");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      playCoin();
      // Send a test welcome notification
      await sendLocalNotification("🔔 เปิดการแจ้งเตือนสำเร็จ!", {
        body: "คุณจะได้รับการแจ้งเตือนเมื่อมีการสุ่มทีม และการเรียกระดมพลเวลา 12:30 และ 18:00 น.",
        tag: "hom-welcome",
      });
      return true;
    } else {
      playBeep(220, 0.2, "sawtooth");
      return false;
    }
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return false;
  }
}

export type ExtendedNotificationOptions = NotificationOptions & {
  vibrate?: number[];
  renotify?: boolean;
  url?: string;
};

// Send Native Local Notification via Service Worker or Fallback
export async function sendLocalNotification(
  title: string,
  options?: ExtendedNotificationOptions,
): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const defaultOptions: ExtendedNotificationOptions = {
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: options?.url || "/",
      timestamp: Date.now(),
    },
    ...options,
  };

  try {
    // 1. Try via active Service Worker registration
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, defaultOptions);
        return true;
      }
    }

    // 2. Fallback to standard window Notification API
    const n = new Notification(title, defaultOptions);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch (err) {
    console.warn("Failed to display native notification:", err);
    return false;
  }
}

// 1. Team Draft Notification (ส่งแจ้งเตือนทันทีเมื่อมีการสุ่มทีม)
export async function notifyTeamDrafted(
  teamA: string[],
  teamB: string[],
  isUnderdog: boolean = false,
): Promise<void> {
  const underdogText = isUnderdog ? " 🔥 [โหมดสู้ยิบตาเปิดใช้งาน!]" : "";
  const title = `🎮 HEROES OF MADNESS: สุ่มทีมแล้ว!`;
  const body = `🔵 BLUE (${teamA.length} คน) vs 🔴 RED (${teamB.length} คน)${underdogText} พร้อมลุยในสังเวียน เข้ามากด Fight ได้เลย!`;

  await sendLocalNotification(title, {
    body,
    tag: "team-drafted",
    url: "/",
  });
}

// 2. Call-to-Arms / Muster Notification (เรียกระดมพลเวลา 12:30, 18:00 หรือกดเรียกเอง)
export async function notifyMuster(
  slot: "12:30" | "18:00" | "manual",
  senderName?: string,
): Promise<void> {
  let title = "📢 เรียกระดมพล HEROES OF MADNESS!";
  let body = "ถึงเวลาสงครามแล้ว! รวมพลเข้าสังเวียนเพื่อสุ่มทีมด่วน";

  if (slot === "12:30") {
    title = "🍱 ได้เวลาศึกพักเที่ยง (12:30 น.)!";
    body =
      "พักเที่ยงแล้ว! เหล่าสหายศึกพร้อมแล้ว เข้าสู่ Heroes of Madness สุ่มทีมกันด่วน!";
  } else if (slot === "18:00") {
    title = "🔥 รวมพลศึกยามเย็น (18:00 น.)!";
    body =
      "เลิกงานแล้ว! เข้าสู่สมรภูมิ Heroes of Madness พร้อมเปิดศึกชิงชัยรอบค่ำ!";
  } else if (slot === "manual") {
    title = `📢 [ประกาศระดมพล] ${senderName || "กัปตันทีม"}`;
    body = "เรียกรวมพลผู้เล่นทุกคนเข้าสังเวียน เดี๋ยวนี้! พร้อมสุ่มทีมลุย!";
  }

  // 1. Send native device notification (for PWA / Browser)
  await sendLocalNotification(title, {
    body,
    tag: `muster-${slot}-${new Date().toDateString()}`,
    url: "/",
  });

  // 2. Trigger server notification (broadcasts to LINE group if configured)
  try {
    await fetch("/api/notifications/muster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot,
        senderName,
        title,
        body,
      }),
    });
  } catch (err) {
    console.warn("Server muster dispatch notice:", err);
  }
}

// 3. Client-side Daily Scheduler (12:30 and 18:00)
const STORAGE_KEY_1230 = "hom_muster_last_1230";
const STORAGE_KEY_1800 = "hom_muster_last_1800";

export function initMusterScheduler(): () => void {
  if (typeof window === "undefined") return () => {};

  const checkMusterTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // Check 12:30
    if (hours === 12 && minutes === 30) {
      const lastFired = localStorage.getItem(STORAGE_KEY_1230);
      if (lastFired !== todayDateStr) {
        localStorage.setItem(STORAGE_KEY_1230, todayDateStr);
        console.log("[MUSTER] Firing 12:30 Lunchtime Muster notification!");
        notifyMuster("12:30");
      }
    }

    // Check 18:00
    if (hours === 18 && minutes === 0) {
      const lastFired = localStorage.getItem(STORAGE_KEY_1800);
      if (lastFired !== todayDateStr) {
        localStorage.setItem(STORAGE_KEY_1800, todayDateStr);
        console.log("[MUSTER] Firing 18:00 Evening Muster notification!");
        notifyMuster("18:00");
      }
    }
  };

  // Check immediately on mount
  checkMusterTime();

  // Check every 30 seconds
  const intervalId = window.setInterval(checkMusterTime, 30000);

  return () => {
    window.clearInterval(intervalId);
  };
}
