export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  const approvedRaw = process.env.APPROVED_EMAILS || '';
  const approved = approvedRaw.split(',').map(e => e.trim().toLowerCase());

  if (!email || !approved.includes(email.trim().toLowerCase())) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.status(200).json({ ok: true });
}
