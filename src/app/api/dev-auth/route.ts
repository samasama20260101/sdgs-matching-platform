import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const devPassword = process.env.DEV_PASSWORD;

  if (!devPassword || password !== devPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('dev-auth', devPassword, {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}
