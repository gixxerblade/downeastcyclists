'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Add form-name field which Netlify requires
    if (!formData.has('form-name')) {
      formData.append('form-name', 'contact');
    }

    // Create the fetch options
    const fetchOptions = {
      method: 'POST',
      headers: {
        // Netlify expects a specific content type for form submissions
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(formData as any).toString(),
    };

    // Submit to Netlify's form handling endpoint
    const netlifyResponse = await fetch('/.netlify/functions/submission-created', fetchOptions);
    
    if (!netlifyResponse.ok) {
      console.error('Netlify form submission failed:', await netlifyResponse.text());
      return NextResponse.json(
        { success: false, message: 'Form submission failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Form submitted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Form submission error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred while submitting the form' },
      { status: 500 }
    );
  }
}
