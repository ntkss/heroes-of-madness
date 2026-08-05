import { db } from "@/utils/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params;

    if (!db) {
      return new Response("Database not configured", { status: 500 });
    }

    const imageRef = doc(db, "matchImages", matchId);
    const docSnap = await getDoc(imageRef);

    if (!docSnap.exists()) {
      return new Response("Match image not found", { status: 404 });
    }

    const data = docSnap.data();
    const base64Image = data.image;

    if (!base64Image) {
      return new Response("Match image data is empty", { status: 404 });
    }

    const imgBuffer = Buffer.from(base64Image, "base64");

    return new Response(imgBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving match image:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
