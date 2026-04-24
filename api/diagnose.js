module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { industry, size, area, challenges, monthly_inquiries, current_tools, goals, budget_timing } = req.body;
    if (!industry || !challenges) { res.status(400).json({ error: '必須項目が不足しています' }); return; }

    const apiKey = process.env.Gemini_API_Key;
    const prompt = `あなたは「生成AI活用型 事前診断・集客・予約最適化システム」の導入適合性を評価する専門アナリストです。
以下の診断回答を分析し、JSON形式のみで回答してください。マークダウン不要。

{"score":<0-100>,"grade":"S|A|B|C","headline":"<30文字以内>","summary":"<150文字以内>","pain_points":[{"title":"課題名","detail":"60文字以内","severity":<1-3>}],"recommended_features":[{"feature":"機能名","reason":"60文字以内","priority":<1-3>}],"roi_estimate":{"workload_reduction":"概算","conversion_improvement":"目安","payback_period":"目安"},"next_step":"immediate|planning|consideration"}

スコア基準: 90-100(S)即導入推奨 / 70-89(A)強く推奨 / 50-69(B)検討 / 0-49(C)要件整理から

【診断データ】
業種: ${industry} / 規模: ${size||'未回答'} / 地域: ${area||'未回答'}
課題: ${Array.isArray(challenges)?challenges.join('、'):challenges}
月間問合せ: ${monthly_inquiries||'未回答'} / 使用ツール: ${current_tools||'なし'}
実現したいこと: ${goals||'未回答'} / 検討時期: ${budget_timing||'未回答'}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API error');

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
    const parsed = JSON.parse(jsonStr);

    res.status(200).json(parsed);
  } catch (err) {
    console.error('Diagnose error:', err);
    res.status(500).json({ error: '診断処理中にエラーが発生しました', detail: err.message });
  }
};
