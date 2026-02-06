// Global queue to ensure only one request is processed at a time across all serverless invocations
let currentRequest = Promise.resolve();

// Cache for the GitHub PAT
let cachedPAT = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getPAT() {
  const now = Date.now();
  if (cachedPAT && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedPAT;
  }

  const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/6981e60cae596e708f0de988';
  try {
    const res = await fetch(JSONBIN_URL, {
      headers: { 'X-Bin-Meta': 'false' }
    });
    const data = await res.json();
    const config = data.record || data;
    
    if (config.github_pat) {
      cachedPAT = config.github_pat;
      lastFetchTime = now;
      return cachedPAT;
    }
    throw new Error('github_pat not found in JSONBin');
  } catch (error) {
    console.error('Error fetching PAT from JSONBin:', error);
    if (cachedPAT) return cachedPAT;
    throw error;
  }
}

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
  const { path: rawPath } = req.query;
  const method = req.method;
  const body = req.body;

  if (!rawPath) {
    return res.status(400).json({ error: 'Path is required.' });
  }

  // ENFORCE AUTHORIZED REPOS ONLY
  // The middleware only processes requests for authorized repositories.
  const AUTHORIZED_REPOS = [
    'Painsel/Everythingtt',
    'Painsel/Everything-TT-Critical-Data'
  ];

  let targetRepo = '';
  let cleanPath = '';

  // Try to extract the repo from the rawPath
  for (const repo of AUTHORIZED_REPOS) {
    const repoPrefix = `/repos/${repo}/`;
    if (rawPath.includes(repoPrefix)) {
      targetRepo = repo;
      const parts = rawPath.split(repoPrefix);
      cleanPath = parts[1];
      // Strip 'contents/' if it's at the start of the remaining path
      cleanPath = cleanPath.replace(/^contents\//, '');
      break;
    }
  }

  // Fallback for relative paths or legacy format
  if (!targetRepo) {
    if (!rawPath.startsWith('/repos/')) {
      targetRepo = 'Painsel/Everythingtt';
      cleanPath = rawPath.replace(/^(\/)?contents\//, '');
    } else {
      console.error(`Unauthorized repository access attempt: ${rawPath}`);
      return res.status(403).json({ error: 'Unauthorized repository access.' });
    }
  }

  // Final API URL construction
  const url = `https://api.github.com/repos/${targetRepo}/contents/${cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath}`;

  // Enqueue the request to ensure serial execution for queuing purposes
  const result = currentRequest.then(async () => {
    try {
      const pat = await getPAT();

      const options = {
        method,
        headers: {
          'Authorization': `token ${pat}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'EverythingTT-Middleware-Queued'
        }
      };

      if (method !== 'GET' && method !== 'HEAD' && body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const contentType = response.headers.get('content-type');
      
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      const data = await response.text();
      return { status: response.status, data };
    } catch (error) {
      console.error('Middleware Error:', error);
      return { 
        status: 500, 
        data: JSON.stringify({ error: 'Middleware Error', message: error.message }) 
      };
    }
  });

  // Update the global queue lock
  currentRequest = result.catch(() => {});

  const finalResult = await result;
  return res.status(finalResult.status).send(finalResult.data);
}
