import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const oneHourInSeconds = 60 * 60; // Firebase ID tokens expire in 1 hour

    cookieStore.set('firebase-id-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: oneHourInSeconds,
    });

    return NextResponse.json({ message: 'Token set successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error setting token cookie:', error);
    // Check if the error is due to invalid JSON
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
