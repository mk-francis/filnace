const fetch = global.fetch || require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const adminSecret = process.env.ADMIN_TEST_SECRET || '';
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const email = (req.query && req.query.email) || (req.body && req.body.email) || '';
  if (!email) return res.status(400).json({ error: 'email required' });
  const url = process.env.SUPABASE_URL || '';
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const redirect = process.env.MAGICLINK_REDIRECT || (req.headers['x-redirect'] || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/index.html` : ''));
  if (!url || !service) return res.status(500).json({ error: 'server not configured' });
  try {
    const r = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': service,
        'Authorization': `Bearer ${service}`
      },
      body: JSON.stringify({ type: 'magiclink', email, options: { redirectTo: redirect || undefined } })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: `generate_link_failed: ${t}` });
    }
    const data = await r.json();
    const link = (data && (data.properties && data.properties.action_link)) || data.action_link || '';
    if (!link) return res.status(500).json({ error: 'no action_link' });
    return res.status(200).json({ link });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};

