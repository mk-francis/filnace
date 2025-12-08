module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL || process.env.supabase_url || '';
  const key = process.env.SUPABASE_ANON_KEY || process.env.supabase_anon_key || '';
  res.status(200).json({ supabase_url: url, supabase_anon_key: key });
};
