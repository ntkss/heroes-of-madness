import { NextResponse } from "next/server";
import crypto from "crypto";

interface LineMentionee {
  index: number;
  length: number;
  userId?: string;
}

interface LineMessage {
  type: string;
  id?: string;
  text?: string;
  mention?: {
    mentionees?: LineMentionee[];
  };
}

interface LineSource {
  type?: string;
  userId?: string;
  groupId?: string;
  roomId?: string;
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: LineSource;
  message?: LineMessage;
  timestamp?: number;
}

function cleanMessageText(
  text: string,
  mention?: { mentionees?: LineMentionee[] },
): string {
  let cleaned = text;

  // Remove mention substrings if present
  if (mention?.mentionees && Array.isArray(mention.mentionees)) {
    const sorted = [...mention.mentionees].sort((a, b) => b.index - a.index);
    for (const m of sorted) {
      if (typeof m.index === "number" && typeof m.length === "number") {
        cleaned = cleaned.slice(0, m.index) + cleaned.slice(m.index + m.length);
      }
    }
  }

  // Remove bot mentions or leading @names that might not have metadata
  cleaned = cleaned.replace(/@heroes\s+of\s+madness/gi, "");
  cleaned = cleaned.replace(/^@[^\s]+\s*/g, "");

  return cleaned.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
    const channelSecret = process.env.LINE_CHANNEL_SECRET?.trim();

    if (!accessToken) {
      console.warn(
        "[LINE Webhook] Received webhook but LINE_CHANNEL_ACCESS_TOKEN is not configured on the server.",
      );
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const bodyText = await request.text();

    // Verify signature if secret is configured
    if (channelSecret) {
      const signature = request.headers.get("x-line-signature");
      if (!signature) {
        console.warn(
          "[LINE Webhook] Rejected request: Missing x-line-signature",
        );
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 },
        );
      }

      const hash = crypto
        .createHmac("sha256", channelSecret)
        .update(bodyText)
        .digest("base64");

      const hashBuf = Buffer.from(hash);
      const sigBuf = Buffer.from(signature);

      if (
        hashBuf.length !== sigBuf.length ||
        !crypto.timingSafeEqual(hashBuf, sigBuf)
      ) {
        console.warn("[LINE Webhook] Rejected request: Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    }

    const body = JSON.parse(bodyText);
    const events: LineEvent[] = body.events || [];

    for (const event of events) {
      const replyToken = event.replyToken;
      if (!replyToken) continue;

      // Skip dummy tokens during LINE console verify / webhook test
      if (
        replyToken === "00000000000000000000000000000000" ||
        replyToken === "ffffffffffffffffffffffffffffffff"
      ) {
        console.log("[LINE Webhook] Skipping dummy verification replyToken");
        continue;
      }

      const source = event.source || {};
      const sourceId =
        source.groupId || source.roomId || source.userId || "unknown";
      const sourceType = source.type || "unknown";

      let responseText = "";

      if (event.type === "join") {
        responseText =
          `🎮 HEROES OF MADNESS BOT CONNECTED!\n\n` +
          `Group Type: ${sourceType.toUpperCase()}\n` +
          `Group ID: ${sourceId}\n\n` +
          `Copy this Group ID and paste it into the admin settings page to automatically post match drafts and results here!`;
      } else if (event.type === "follow") {
        responseText =
          `🎮 HEROES OF MADNESS BOT\n\n` +
          `ยินดีต้อนรับสู่ Heroes of Madness Bot!\n\n` +
          `🎯 YOUR USER ID:\n${sourceId}\n\n` +
          `📌 วิธีตั้งค่าแจ้งเตือนกลุ่ม:\n` +
          `1. เชิญบอทเข้ากลุ่ม LINE ที่ต้องการรับแจ้งเตือน\n` +
          `2. พิมพ์ /groupid หรือ @Heroes of Madness id ในกลุ่ม\n` +
          `3. นำ Group ID ไปใส่ในหน้า Admin Settings ในเว็บไซต์`;
      } else if (
        event.type === "message" &&
        event.message &&
        event.message.type === "text"
      ) {
        const rawText = event.message.text || "";
        const clean = cleanMessageText(rawText, event.message.mention);

        const isIdQuery =
          clean === "/groupid" ||
          clean === "groupid" ||
          clean === "group id" ||
          clean === "/group_id" ||
          clean === "/id" ||
          clean === "id" ||
          clean === "!id" ||
          clean === "!groupid" ||
          clean === "/chatid" ||
          clean === "chatid" ||
          clean === "ไอดี" ||
          clean === "ไอดีกลุ่ม" ||
          clean === "เช็คไอดี";

        const isInfoQuery =
          clean === "/bot" ||
          clean === "bot" ||
          clean === "/info" ||
          clean === "info" ||
          clean === "/help" ||
          clean === "help" ||
          clean === "บอท" ||
          clean === "ช่วยเหลือ";

        if (isIdQuery || isInfoQuery) {
          responseText =
            `🎯 LINE CHAT INFO:\n\n` +
            `Type: ${sourceType.toUpperCase()}\n` +
            `ID: ${sourceId}\n\n` +
            `Configure this in the Heroes of Madness Settings panel to stream drafts and results.`;
        } else if (sourceType === "user") {
          // If in 1-on-1 private chat with the bot and any message is sent, offer helpful guidance
          responseText =
            `🎯 HEROES OF MADNESS BOT\n\n` +
            `Type: USER\n` +
            `Your User ID: ${sourceId}\n\n` +
            `พิมพ์ /groupid ในกลุ่ม LINE เพื่อรับ Group ID สำหรับตั้งค่าระบบสตรีมผลดราฟต์และสรุปการแข่งขัน!`;
        }
      }

      if (responseText) {
        const replyResponse = await fetch(
          "https://api.line.me/v2/bot/message/reply",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              replyToken: replyToken,
              messages: [
                {
                  type: "text",
                  text: responseText,
                },
              ],
            }),
          },
        );

        if (!replyResponse.ok) {
          console.error(
            "[LINE Webhook] Failed to reply to LINE:",
            await replyResponse.text(),
          );
        } else {
          console.log(
            `[LINE Webhook] Successfully replied to ${sourceType} (${sourceId})`,
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[LINE Webhook] Error handling webhook:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
