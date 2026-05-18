module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const API_KEY = process.env.GOOGLE_API_KEY;

  if (!SHEET_ID || !API_KEY) {
    return res.status(503).json({ error: 'No pre-loaded scan available yet.' });
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/LatestScan!A2?key=${API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Could not read from Google Sheets.');
    const data = await r.json();
    const raw = data?.values?.[0]?.[0];
    if (!raw) return res.status(404).json({ error: 'No scan data found.' });
    return res.status(200).json(JSON.parse(raw));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
