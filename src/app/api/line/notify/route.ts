import { NextResponse } from "next/server";
import { db } from "@/utils/firebase";
import { doc, setDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const { messageText, groupId, imageUrl, imageBuffer, matchId } = await request.json();

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

    let finalImageUrl = imageUrl;

    // Save image base64 directly to Firestore under matchesImages collection
    if (imageBuffer && matchId && db) {
      try {
        const host = request.headers.get("host") || "localhost:3000";
        const protocol = host.startsWith("localhost") ? "http" : "https";
        const baseUrl = `${protocol}://${host}`;

        console.log(`[LINE API] Storing matchup image in Firestore for match ${matchId}...`);
        const imageRef = doc(db, "matchImages", matchId);
        await setDoc(imageRef, {
          image: imageBuffer,
          createdAt: Date.now(),
        });

        finalImageUrl = `${baseUrl}/api/line/image/${matchId}`;
        console.log(`[LINE API] Image saved. Serving URL: ${finalImageUrl}`);
      } catch (dbError) {
        console.error("[LINE API] Failed to store image in Firestore:", dbError);
      }
    }

    const messages: {
      type: string;
      text?: string;
      originalContentUrl?: string;
      previewImageUrl?: string;
    }[] = [];

    if (messageText) {
      messages.push({
        type: "text",
        text: messageText,
      });
    }

    if (finalImageUrl) {
      messages.push({
        type: "image",
        originalContentUrl: finalImageUrl,
        previewImageUrl: finalImageUrl,
      });
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Either messageText or image is required." },
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
        messages,
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

    return NextResponse.json({ success: true, imageUrl: finalImageUrl });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[LINE API] Exception in notify API route:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
