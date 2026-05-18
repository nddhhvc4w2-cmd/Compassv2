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
    return res.status(500).json({ error: 'Missing API keys. Check environment variables.' });
  }

  const QUERIES = [
    `innovation signals global health longevity 2026`,
    `education technology future skills development 2026`,
    `water food security climate adaptation innovation 2026`,
    `clean energy social innovation philanthropy 2026`,
  ];

  try {
    // Step 1: Tavily search (4 queries in parallel)
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

    // Step 2: Format evidence
    const evidencePack = searchResults.map((data, i) =>
      `QUERY: ${QUERIES[i]}\n` +
      (data.results || []).map((r, j) =>
        `[${j+1}] ${r.title}\n${r.content?.slice(0, 300)}\nSource: ${r.url}`
      ).join('\n\n')
    ).join('\n\n---\n\n');

    // Step 3: Claude analysis
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
        system: `You are Compass, a strategic foresight intelligence agent. Analyze only the provided evidence and return ONLY valid JSON — no markdown, no explanation, just the raw JSON object.

Matrix placement:
- amplify: Novel AND immediately strategic — act now
- anticipate: Novel, high potential — watch carefully
- adopt: Proven, actionable — implement now
- explore: Interesting but uncertain — monitor

Return exactly this JSON structure:
{
  "executiveSummary": "3-4 sentences on the current landscape",
  "runDate": "${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}",
  "crossCuttingPatterns": [
    {"title":"pattern title","description":"one sentence insight"}
  ],
  "signals": [
    {
      "id": "s1",
      "title": "5-8 word signal title",
      "domain": "health|education|food|water|energy|biodiversity|social|philanthropy",
      "quadrant": "amplify|anticipate|adopt|explore",
      "confidenceTier": "high|medium|low",
      "strategicImplication": "max 12 words",
      "summary": "2-3 sentences",
      "whyItMatters": "1-2 sentences",
      "recommendedAction": "specific action",
      "evidenceSources": [{"title":"...","url":"...","sourceName":"..."}]
    }
  ]
}

Rules: 6-10 signals total, at least 1 per quadrant, exactly 3 patterns. Only use evidence provided.`,
        messages: [{
          role: 'user',
          content: `Focus area: ${focusArea}\n\nEvidence:\n\n${evidencePack}\n\nReturn only the JSON object.`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();

    if (claudeData.error) {
      throw new Error(`Claude error: ${claudeData.error.message}`);
    }
    if (!claudeData.content) {
      throw new Error(`Unexpected response: ${JSON.stringify(claudeData).slice(0, 200)}`);
    }

    const text = claudeData.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse JSON from Claude response.');

    const result = JSON.parse(match[0]);
    return res.status(200).json(result);

  } catch (err) {
    console.error('[Compass]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
