import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) { // Can also be GET if preferred
  try {
    const cookieStore = cookies();

    // Check if the cookie exists before trying to clear it
    const tokenCookie = cookieStore.get('firebase-id-token');

    if (!tokenCookie) {
      return NextResponse.json({ message: 'Token cookie not found or already cleared.' }, { status: 200 });
    }

    cookieStore.set('firebase-id-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: -1, // Or expires: new Date(0)
    });

    return NextResponse.json({ message: 'Token cleared successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error clearing token cookie:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
