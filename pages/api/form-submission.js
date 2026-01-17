// This is a Next.js API route that acts as a proxy to the Netlify function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({message: 'Method not allowed'});
  }

  try {
    // Forward the request to the Netlify function
    const netlifyResponse = await fetch('/.netlify/functions/submission-created', {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body),
    });

    const data = await netlifyResponse.json();

    // Return the Netlify function's response
    return res.status(netlifyResponse.status).json(data);
  } catch (error) {
    console.error('Error forwarding to Netlify function:', error);
    return res.status(500).json({message: 'Internal server error'});
  }
}
