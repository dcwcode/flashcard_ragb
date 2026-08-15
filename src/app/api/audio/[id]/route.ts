import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const audio = await prisma.audioFile.findFirst({
    where: { id: params.id, deck: { userId: auth.user.id } },
  });
  if (!audio) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bytes = new Uint8Array(audio.data);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": audio.mimeType || "audio/mpeg",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
