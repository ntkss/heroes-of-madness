import { NextResponse } from "next/server";
import { fetchLineConfig } from "@/utils/firebase";

async function handleMusterCron(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeParam = searchParams.get("time"); // e.g. "1230" or "1800"
    const secretKeyParam = searchParams.get("key");

    // Optional secret authorization for cron-job.org
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const customHeader = request.headers.get("x-cron-secret");
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

      const providedSecret = bearerToken || customHeader || secretKeyParam;
      if (providedSecret !== cronSecret) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing cron secret" },
          { status: 401 },
        );
      }
    }

    // Determine current hour in Bangkok timezone (UTC+7)
    const bangkokTimeStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).format(new Date());

    const bangkokHour = parseInt(bangkokTimeStr.split(":")[0], 10) || 12;

    // Determine slot: explicit query param or auto-detect based on current Bangkok hour
    let isLunch = true;
    if (timeParam === "1800") {
      isLunch = false;
    } else if (timeParam === "1230") {
      isLunch = true;
    } else {
      // Auto-detect: if >= 15:00 (3 PM), assume evening slot (18:00)
      isLunch = bangkokHour < 15;
    }

    const slot = isLunch ? "12:30" : "18:00";
    const slotText = isLunch
      ? "🍱 ได้เวลาศึกพักเที่ยง (12:30 น.)"
      : "🔥 เลิกงานแล้ว รวมพลศึกยามเย็น (18:00 น.)";

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const appUrl = `${protocol}://${host}`;

    const lineConfig = await fetchLineConfig();
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    let lineNotified = false;
    let lineError: string | null = null;

    if (lineConfig.enabled && lineConfig.groupId && accessToken) {
      const messageText =
        `📢 [ระบบเรียกระดมพลอัตโนมัติ HEROES OF MADNESS]\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ ${slotText}\n` +
        `👑 สัญญาณเตือนระดมพลดังขึ้นแล้ว! ขอเชิญผู้กล้าทุกท่านเปิดแอปเข้าสังเวียนเพื่อสุ่มทีมลุย!\n\n` +
        `🔗 เข้าร่วมสมรภูมิ: ${appUrl}`;

      try {
        const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            to: lineConfig.groupId,
            messages: [
              {
                type: "text",
                text: messageText,
              },
            ],
          }),
        });

        if (!lineRes.ok) {
          const errData = await lineRes.json().catch(() => ({}));
          lineError = JSON.stringify(errData);
        } else {
          lineNotified = true;
        }
      } catch (err) {
        lineError = String(err);
      }
    }

    return NextResponse.json({
      success: true,
      service: "cron-job.org / external cron",
      cronSlot: slot,
      bangkokCurrentTime: bangkokTimeStr,
      lineNotified,
      lineError,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron muster error:", error);
    return NextResponse.json(
      { error: "Cron execution failed: " + String(error) },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleMusterCron(request);
}

export async function POST(request: Request) {
  return handleMusterCron(request);
}
