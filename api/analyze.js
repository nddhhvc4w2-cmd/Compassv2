module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { focusArea } = req.body || {};
  if (!focusArea?.trim()) return res.status(400).json({ error: 'focusArea is required' });

  const TAVILY_KEY = process.env.TAVILY_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!TAVILY_KEY || !ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'Missing API keys.' });
  }

  const QUERIES = [
    `latest innovation signals global health longevity development 2026`,
    `emerging education technology future skills development 2026`,
    `water security innovation climate adaptation 2026`,
    `philanthropy innovative finance global development 2026`,
    `food systems agriculture innovation climate resilience 2026`,
    `clean energy transition innovation developing countries 2026`,
    `social cohesion human development innovation 2026`,
    `biodiversity conservation technology innovation 2026`,
  ];

  try {
    const allResults = [];
    for (const query of QUERIES) {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: `${query} ${focusArea}`,
          search_depth: 'basic',
          max_results: 3,
          include_answer: false,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        allResults.push({ query, results: d.results || [] });
      }
    }

    const evidencePack = allResults.map(({ query, results }) =>
      `QUERY: ${query}\n` +
      results.map((r, i) => `[${i+1}] ${r.title}\n${r.content}\nSource: ${r.url}`).join('\n\n')
    ).join('\n\n---\n\n');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are Compass, a strategic foresight intelligence agent. Analyze only the provided evidence and return ONLY valid JSON — no markdown, no explanation.

Matrix placement:
- amplify: Novel AND immediately strategic — act now
- anticipate: Novel, high potential — watch carefully  
- adopt: Proven, actionable — implement now
- explore: Interesting but uncertain — monitor

Return exactly this structure:
{
  "executiveSummary": "3-4 sentences",
  "runDate": "${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}",
  "crossCuttingPatterns": [{"title":"...","description":"..."}],
  "signals": [{
    "id": "s1",
    "title": "5-8 word title",
    "domain": "health|education|food|water|energy|biodiversity|social|philanthropy",
    "quadrant": "amplify|anticipate|adopt|explore",
    "confidenceTier": "high|medium|low",
    "strategicImplication": "max 12 words",
    "summary": "2-3 sentences",
    "whyItMatters": "1-2 sentences",
    "recommendedAction": "specific action",
    "evidenceSources": [{"title":"...","url":"...","sourceName":"..."}]
  }]
}

Rules: 8-12 signals, min 2 per quadrant, exactly 3 patterns. Only use evidence provided. No invented sources.`,
        messages: [{
          role: 'user',
          content: `Focus area: ${focusArea}\n\nEvidence:\n\n${evidencePack}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse Claude response as JSON.');
    const result = JSON.parse(match[0]);

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
