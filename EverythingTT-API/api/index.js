export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get parameters from query and body
  const { path } = req.query;
  const method = req.method;
  const body = req.body;

  if (!path) {
    return res.status(400).json({ error: 'Path is required. Use ?path=/contents/path/to/file' });
  }

  // Use the GitHub PAT from environment variables
  const GITHUB_PAT = process.env.GITHUB_PAT;

  if (!GITHUB_PAT) {
    return res.status(500).json({ 
      error: 'Server configuration error', 
      message: 'Missing GITHUB_PAT environment variable on Vercel' 
    });
  }

  // Construct the GitHub API URL
  // If path starts with /repos/, use it directly, otherwise assume it's a relative path for Painsel/Everythingtt
  let url;
  if (path.startsWith('/repos/')) {
    url = `https://api.github.com${path}`;
  } else {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    url = `https://api.github.com/repos/Painsel/Everythingtt${cleanPath}`;
  }

  try {
    const options = {
      method,
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'EverythingTT-Middleware'
      }
    };

    if (method !== 'GET' && method !== 'HEAD' && body) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    // Set the same content type as GitHub's response
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const data = await response.text();
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('Middleware Error:', error);
    return res.status(500).json({ 
      error: 'Middleware Error', 
      message: error.message 
    });
  }
}
