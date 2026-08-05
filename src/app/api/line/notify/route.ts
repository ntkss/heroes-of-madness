import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { messageText, groupId } = await request.json();

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!accessToken) {
      console.error(
        "[LINE API] Missing LINE_CHANNEL_ACCESS_TOKEN environment variable.",
      );
      return NextResponse.json(
        { error: "LINE Channel Access Token is not configured on the server." },
        { status: 500 },
      );
    }

    if (!groupId) {
      return NextResponse.json(
        { error: "LINE Group ID is required." },
        { status: 400 },
      );
    }

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [
          {
            type: "text",
            text: messageText,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        "[LINE API] Error response from LINE push endpoint:",
        errText,
      );
      return NextResponse.json(
        { error: `LINE API returned error: ${errText}` },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[LINE API] Exception in notify API route:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
