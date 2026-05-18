module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { focusArea, domains } = req.body || {};
  if (!focusArea?.trim()) return res.status(400).json({ error: 'focusArea is required' });

  const TAVILY_KEY = process.env.TAVILY_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!TAVILY_KEY || !ANTHROPIC_KEY) return res.status(500).json({ error: 'Missing API keys.' });

  const ALL_QUERIES = {
    health:       'global health longevity innovation 2026',
    education:    'education technology skills development 2026',
    food:         'food agriculture security innovation 2026',
    water:        'water security innovation 2026',
    energy:       'clean energy transition innovation 2026',
    biodiversity: 'biodiversity climate resilience innovation 2026',
    social:       'social cohesion human development innovation 2026',
    philanthropy: 'philanthropy innovative finance development 2026',
  };

  const selectedDomains = (domains && domains.length > 0)
    ? domains.filter(d => ALL_QUERIES[d])
    : Object.keys(ALL_QUERIES);

  try {
    const searchResults = await Promise.all(
      selectedDomains.map(domain =>
        fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: TAVILY_KEY,
            query: ALL_QUERIES[domain] + ' ' + focusArea,
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
      `DOMAIN: ${selectedDomains[i]}\n` +
      (data.results || []).map((r, j) =>
        `[${j+1}] ${r.title}\n${r.content?.slice(0, 300)}\nSource: ${r.url}`
      ).join('\n\n')
    ).join('\n\n---\n\n');

    const signalsPerQuadrant = Math.max(1, Math.floor(12 / 4));
    const totalSignals = signalsPerQuadrant * 4;

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

From the evidence, identify exactly ${totalSignals} signals — ${signalsPerQuadrant} per quadrant, highest impact only:

AMPLIFY (${signalsPerQuadrant}): Opportunities with strong evidence to scale RIGHT NOW
ANTICIPATE (${signalsPerQuadrant}): Emerging trends leaders need to get ahead of
ADOPT (${signalsPerQuadrant}): Proven solutions ready to implement this week
EXPLORE (${signalsPerQuadrant}): Interesting signals worth monitoring

Writing rules — non-negotiable:
- Write like you're briefing a smart, busy Minister or CEO
- Zero jargon. Zero filler. Every word earns its place.
- Specific names, figures, dates from the evidence.
- "soWhat" = one plain sentence a non-expert immediately understands

Return ONLY valid JSON, no markdown:
{
  "executiveSummary": "3-4 plain sentences. What is happening right now that matters.",
  "runDate": "${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}",
  "focusArea": "${focusArea}",
  "crossCuttingPatterns": [
    {"title": "short bold title", "description": "one plain sentence"}
  ],
  "signals": [
    {
      "id": "s1",
      "title": "bold 5-8 word title",
      "domain": "${selectedDomains.join('|')}",
      "quadrant": "amplify|anticipate|adopt|explore",
      "confidenceTier": "high|medium|low",
      "soWhat": "One sentence. Why a busy leader should care.",
      "summary": "2-3 sentences. What is happening and where.",
      "whyItMatters": "Direct relevance to the focus area.",
      "recommendedAction": "One specific action. Start with a verb.",
      "evidenceSources": [{"title":"...","url":"...","sourceName":"..."}]
    }
  ]
}

Rules: exactly ${totalSignals} signals (${signalsPerQuadrant} per quadrant), exactly 3 patterns. Only use provided evidence.`,
        messages: [{
          role: 'user',
          content: `Focus area: ${focusArea}\nDomains: ${selectedDomains.join(', ')}\n\nEvidence:\n\n${evidencePack}\n\nReturn only the JSON.`,
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
