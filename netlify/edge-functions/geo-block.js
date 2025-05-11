export default async function geoBlock(req, context) {
  // Get geo information and client IP from the context
  const { geo, ip } = context;
  
  // Check if the request is from outside the US
  if (geo.country.code !== 'US') {
    // For non-US traffic, implement stricter response handling
    
    // Get request headers for additional security checks
    const userAgent = req.headers.get('user-agent') || '';
    const referer = req.headers.get('referer') || '';
    
    // Simple heuristic for potential DDoS detection
    // This is a basic example - in production you would use more sophisticated detection
    const suspiciousRequest = 
      !userAgent || 
      userAgent.length < 10 || 
      (req.method !== 'GET' && req.method !== 'HEAD');
    
    // If the request looks suspicious, return a minimal response with 429 status
    if (suspiciousRequest) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Content-Type': 'text/plain',
          'Retry-After': '300',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block'
        }
      });
    }
    // Create a nicely formatted HTML page for blocked users
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Access Restricted</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              background-color: #f5f5f5;
              color: #333;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              padding: 20px;
              text-align: center;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              padding: 40px;
              max-width: 500px;
              width: 100%;
            }
            h1 {
              color: #e53e3e;
              margin-top: 0;
            }
            p {
              font-size: 18px;
              line-height: 1.6;
            }
            .country {
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Access Restricted</h1>
            <p>We're sorry, but our content is not available in <span class="country">${geo.country.name}</span> at this time.</p>
            <p>Our services are currently only available to users in the United States.</p>
          </div>
        </body>
      </html>
    `;

    // Return the HTML with appropriate headers
    return new Response(html, {
      headers: { 
        'content-type': 'text/html',
        'Cache-Control': 'no-cache'
      },
      status: 403 // Forbidden status code
    });
  }
  
  // For users in the United States, allow the request to proceed
  return;
}
