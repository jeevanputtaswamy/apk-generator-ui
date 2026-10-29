/**
 * Netlify / Vercel Serverless Function: api/build.js
 * 
 * Secure Backend Proxy:
 * - Accepts POST from public frontend { appUrl, appName, packageId, iconUrl }
 * - Uses process.env.GITHUB_PAT (Host's secret Personal Access Token)
 * - Dispatches repository_dispatch to your central build repository
 * - Public visitors NEVER need or see any API keys!
 */

export default async function handler(req, res) {
  // Enable CORS for public frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { appUrl, appName, packageId, iconUrl } = req.body || {};

  // 1. Validation
  if (!appUrl || !appUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'HTTPS URL is required.' });
  }
  if (!packageId || !/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageId)) {
    return res.status(400).json({ error: 'Valid Android package ID required.' });
  }

  // 2. Host Secret Environment Variables
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GITHUB_REPO = process.env.GITHUB_REPO || 'YOUR_USERNAME/apk-engine';

  if (!GITHUB_PAT) {
    return res.status(500).json({
      error: 'Host error: GITHUB_PAT is missing in environment variables.'
    });
  }

  const buildId = `apk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 3. Dispatch to GitHub Actions Cloud Runner
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'APKForge-Proxy',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event_type: 'build-twa-apk',
      client_payload: { buildId, appUrl, appName, packageId, iconUrl }
    })
  });

  if (!response.ok) {
    return res.status(502).json({ error: 'Failed to dispatch workflow run.' });
  }

  return res.status(202).json({
    success: true,
    buildId,
    status: 'queued',
    stage: 'Connecting to Build Engine...',
    message: 'Build dispatched to GitHub Actions Cloud Runner.'
  });
    }
