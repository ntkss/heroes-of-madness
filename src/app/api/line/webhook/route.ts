import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    if (!accessToken) {
      console.warn("[LINE Webhook] Received webhook but LINE_CHANNEL_ACCESS_TOKEN is not configured on the server.");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const bodyText = await request.text();

    // Verify signature if secret is configured
    if (channelSecret) {
      const signature = request.headers.get("x-line-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
      const hash = crypto
        .createHmac("sha256", channelSecret)
        .update(bodyText)
        .digest("base64");
      if (hash !== signature) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(bodyText);
    const events = body.events || [];

    for (const event of events) {
      const replyToken = event.replyToken;
      if (!replyToken) continue;

      const source = event.source || {};
      const sourceId = source.groupId || source.roomId || source.userId || "unknown";
      const sourceType = source.type || "unknown";

      let responseText = "";

      if (event.type === "join") {
        responseText = `🎮 HEROES OF MADNESS BOT CONNECTED!\n\n` +
          `Group Type: ${sourceType.toUpperCase()}\n` +
          `Group ID: ${sourceId}\n\n` +
          `Copy this Group ID and paste it into the admin settings page to automatically post match drafts and results here!`;
      } else if (event.type === "message" && event.message && event.message.type === "text") {
        const text = event.message.text.trim().toLowerCase();
        if (text === "/groupid" || text === "/id" || text === "/bot" || text === "/info") {
          responseText = `🎯 LINE CHAT INFO:\n\n` +
            `Type: ${sourceType.toUpperCase()}\n` +
            `ID: ${sourceId}\n\n` +
            `Configure this in the Heroes of Madness Settings panel to stream drafts and results.`;
        }
      }

      if (responseText) {
        const replyResponse = await fetch("https://api.line.me/v2/bot/message/reply", {
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
        });

        if (!replyResponse.ok) {
          console.error("[LINE Webhook] Failed to reply to LINE:", await replyResponse.text());
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[LINE Webhook] Error handling webhook:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
