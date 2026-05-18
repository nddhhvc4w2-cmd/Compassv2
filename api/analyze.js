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
    `global health longevity innovation 2026`,
    `education technology skills development 2026`,
    `water food security climate adaptation 2026`,
    `clean energy biodiversity innovation 2026`,
    `social cohesion philanthropy innovative finance 2026`,
    `human development resilience innovation 2026`,
  ];

  try {
    const searchResults = await Promise.all(
      QUERIES.map(q =>
        fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: TAVILY_KEY,
            query: q + ' ' + focusArea,
            search_depth: 'basic',
            max_results: 4,
            include_answer: false,
          }),
        })
        .then(r => r.ok ? r.json() : { results: [] })
        .catch(() => ({ results: [] }))
      )
    );

    const evidencePack = searchResults.map((data, i) =>
      `QUERY: ${QUERIES[i]}\n` +
      (data.results || []).map((r, j) =>
        `[${j+1}] ${r.title}\n${r.content?.slice(0, 300)}\nSource: ${r.url}`
      ).join('\n\n')
    ).join('\n\n---\n\n');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: `You are Compass, a strategic intelligence agent briefing senior leaders in philanthropy and global development.

From the evidence provided, identify exactly 12 signals — the 3 highest-impact ones in each quadrant:

AMPLIFY (3 signals): Opportunities with strong evidence that leaders should scale RIGHT NOW
ANTICIPATE (3 signals): Emerging trends not mainstream yet — leaders need to get ahead of them
ADOPT (3 signals): Proven solutions already working — leaders should start implementing this week
EXPLORE (3 signals): Interesting signals worth monitoring — not urgent but don't ignore them

Pick the best 3 per quadrant from across all 8 domains: health, education, food, water, energy, biodiversity, social, philanthropy.

Writing rules — this is non-negotiable:
- Write like you're briefing a smart, busy CEO who has 2 minutes
- Zero jargon. Zero filler. Every word earns its place.
- Be specific. Real names, figures, dates from the evidence.
- "soWhat" must be one plain English sentence a 15-year-old understands

Return ONLY valid JSON, no markdown, no explanation:
{
  "executiveSummary": "3-4 plain sentences. What is happening right now that matters.",
  "runDate": "${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}",
  "crossCuttingPatterns": [
    {"title": "short bold title", "description": "one plain sentence — what connects across domains"}
  ],
  "signals": [
    {
      "id": "s1",
      "title": "bold 5-8 word title",
      "domain": "health|education|food|water|energy|biodiversity|social|philanthropy",
      "quadrant": "amplify|anticipate|adopt|explore",
      "confidenceTier": "high|medium|low",
      "soWhat": "One plain English sentence. Why should a busy leader care?",
      "summary": "2-3 sentences. What is happening and where.",
      "whyItMatters": "1-2 sentences. Direct relevance to the focus area.",
      "recommendedAction": "One specific action. Start with a verb.",
      "evidenceSources": [{"title": "...", "url": "...", "sourceName": "..."}]
    }
  ]
}

Rules: exactly 12 signals (3 per quadrant), exactly 3 patterns. Only use evidence provided. No invented sources.`,
        messages: [{
          role: 'user',
          content: `Focus area: ${focusArea}\n\nEvidence:\n\n${evidencePack}\n\nReturn only the JSON.`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    if (claudeData.error) throw new Error(`Claude error: ${claudeData.error.message}`);
    if (!claudeData.content) throw new Error(`Unexpected response: ${JSON.stringify(claudeData).slice(0, 200)}`);

    const text = claudeData.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse JSON from Claude response.');

    return res.status(200).json(JSON.parse(match[0]));

  } catch (err) {
    console.error('[Compass]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
