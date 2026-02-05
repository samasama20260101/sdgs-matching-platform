// app/api/classify-sdgs/route.ts
import { NextResponse } from "next/server";
import { classifySDGs } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const consultationText = String(body?.consultationText ?? "");

    // バリデーション
    if (!consultationText || consultationText.length < 10) {
      return NextResponse.json(
        { 
          success: false, 
          error: consultationText.length < 10 
            ? '相談内容は10文字以上入力してください' 
            : '相談内容が必要です' 
        },
        { status: 400 }
      );
    }

    const result = await classifySDGs(consultationText);

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
