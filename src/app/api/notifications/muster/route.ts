import { NextResponse } from "next/server";
import { fetchLineConfig } from "@/utils/firebase";

// In-memory cooldown store to prevent LINE quota burnout (500 pushes/month limit)
// Rate-limits manual & automated bursts to at most once per 15 minutes (900,000 ms)
const COOLDOWN_MS = 15 * 60 * 1000;
let lastMusterTimestamp = 0;

export async function POST(request: Request) {
  try {
    const { slot, senderName, title, body } = await request.json();

    const lineConfig = await fetchLineConfig();
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    const now = Date.now();
    const isUnderCooldown = now - lastMusterTimestamp < COOLDOWN_MS;

    let lineNotified = false;
    let lineSkippedReason: string | null = null;

    // If LINE is configured and enabled, broadcast muster alert to the LINE group
    if (lineConfig.enabled && lineConfig.groupId && accessToken) {
      if (isUnderCooldown && slot === "manual") {
        const remainingMinutes = Math.ceil(
          (COOLDOWN_MS - (now - lastMusterTimestamp)) / 60000,
        );
        lineSkippedReason = `LINE broadcast rate-limited. Cooldown active for another ${remainingMinutes} minute(s) to protect quota.`;
        console.warn(`[LINE Quota Guard] ${lineSkippedReason}`);
      } else {
        const timeEmoji =
          slot === "12:30" ? "🍱" : slot === "18:00" ? "🔥" : "📢";
        const slotText =
          slot === "12:30"
            ? "ศึกพักเที่ยง (12:30 น.)"
            : slot === "18:00"
              ? "ศึกยามเย็น (18:00 น.)"
              : "ประกาศเรียกระดมพลพิเศษ";

        const host = request.headers.get("host") || "localhost:3000";
        const protocol = host.startsWith("localhost") ? "http" : "https";
        const appUrl = `${protocol}://${host}`;

        const messageText =
          `${timeEmoji} [HEROES OF MADNESS - เรียกระดมพล!]\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `⚔️ ${slotText}\n` +
          `👑 ${senderName ? `กัปตัน ${senderName}` : "กัปตันทีม"} ขอเชิญผู้กล้าทุกท่านรวมพลเข้าสังเวียนพร้อมสุ่มทีม!\n\n` +
          `🔗 เข้าร่วมสมรภูมิ: ${appUrl}`;

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
          const lineErr = await lineRes.json();
          console.warn("[LINE API] Muster notify error:", lineErr);
        } else {
          lastMusterTimestamp = now;
          lineNotified = true;
          console.log(`[LINE API] Muster notify sent for slot: ${slot}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      slot,
      title,
      body,
      lineNotified,
      lineSkippedReason,
    });
  } catch (error) {
    console.error("Error in muster notification route:", error);
    return NextResponse.json(
      { error: "Failed to dispatch muster notification: " + String(error) },
      { status: 500 },
    );
  }
}
