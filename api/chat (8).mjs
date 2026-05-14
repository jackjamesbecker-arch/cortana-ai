const rateLimit = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) { rateLimit.set(ip, { count: 1, start: now }); return true; }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  rateLimit.set(ip, entry);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const apiKey = process.env.GOOGLE_AI_KEY;
  console.log('Google AI key present:', !!apiKey);
  if (!apiKey) return res.status(500).json({ error: 'Google AI key not configured' });

  try {
    const { system, messages, email } = req.body;
    console.log('Email:', email, 'Messages:', messages?.length);

    // EMAIL GATE
    const approvedRaw = process.env.APPROVED_EMAILS || '';
    const approved = approvedRaw.split(',').map(e => e.trim().toLowerCase());
    if (!email || !approved.includes(email.toLowerCase())) {
      return res.status(403).json({ error: 'Access denied. Email not on approved list.' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages' });
    }

    // Build Gemini contents — alternate user/model roles
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const payload = {
      system_instruction: { parts: [{ text: system || 'You are Cortana, UNSC AI CTN 0452-9.' }] },
      contents,
      generationConfig: { maxOutputTokens: 800, temperature: 0.9 }
    };

    console.log('Calling Gemini...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    console.log('Gemini status:', response.status);
    console.log('Gemini data:', JSON.stringify(data).substring(0, 400));

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini error' });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('No text in response:', JSON.stringify(data));
      return res.status(500).json({ error: 'Empty response from Gemini' });
    }

    // Return in same format frontend expects
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
