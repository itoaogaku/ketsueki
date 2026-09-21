import { NextRequest, NextResponse } from "next/server";
import { checkJoshiPasscode, isJoshiSecretConfigured, joshiSessionToken, JOSHI_COOKIE_NAME } from "@/lib/joshi-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isJoshiSecretConfigured()) {
    return NextResponse.json(
      { error: "WOMEN_DASHBOARD_SECRET が設定されていません" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const secret = typeof body?.secret === "string" ? body.secret : "";
  if (!checkJoshiPasscode(secret)) {
    return NextResponse.json({ error: "パスコードが正しくありません" }, { status: 401 });
  }

  const token = joshiSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(JOSHI_COOKIE_NAME, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30日
  });
  return res;
}
