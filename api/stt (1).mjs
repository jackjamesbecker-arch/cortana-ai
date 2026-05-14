export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Deepgram key not configured' });

  try {
    // req.body is the raw audio buffer sent from the browser
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audioBuffer = Buffer.concat(chunks);

    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': req.headers['content-type'] || 'audio/webm',
      },
      body: audioBuffer,
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.err_msg || 'Deepgram error' });

    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('STT error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
