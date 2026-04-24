const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `あなたは「生成AI活用型 事前診断・集客・予約最適化システム」の導入適合性を評価する専門アナリストです。
顧客が入力した診断フォームの回答を分析し、以下のJSON形式のみで回答してください。それ以外のテキストは一切出力しないでください。

{
  "score": <0-100の整数。導入適合スコア>,
  "grade": <"S" | "A" | "B" | "C">,
  "headline": <30文字以内の診断結果タイトル>,
  "summary": <150文字以内の総評>,
  "pain_points": [
    { "title": "課題名", "detail": "60文字以内の詳細", "severity": <1-3> }
  ],
  "recommended_features": [
    { "feature": "機能名", "reason": "60文字以内の推奨理由", "priority": <1-3> }
  ],
  "roi_estimate": {
    "workload_reduction": "<削減工数の概算（例：月40時間）>",
    "conversion_improvement": "<成約率改善の目安（例：+15〜25%）>",
    "payback_period": "<投資回収期間の目安（例：12〜18ヶ月）>"
  },
  "next_step": <"immediate" | "planning" | "consideration">
}

スコア基準:
- 90-100 (S): 即導入推奨。課題が明確で費用対効果が高い
- 70-89  (A): 導入強く推奨。主要課題に直接対応可能
- 50-69  (B): 導入検討。一部業務への効果が期待できる
- 0-49   (C): 現状把握フェーズ。要件整理から開始を推奨`;

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { industry, size, area, challenges, monthly_inquiries, current_tools, goals, budget_timing } = req.body;

    if (!industry || !challenges) {
      res.status(400).json({ error: '必須項目が不足しています' });
      return;
    }

    const userContent = `
【診断回答データ】

業種/業界: ${industry}
企業規模: ${size || '未回答'}
地域: ${area || '未回答'}

現在の課題（複数選択）:
${Array.isArray(challenges) ? challenges.map(c => `- ${c}`).join('\n') : challenges}

月間問い合わせ・集客数: ${monthly_inquiries || '未回答'}

現在使用中のツール・システム:
${current_tools || 'なし／未回答'}

導入で実現したいこと:
${goals || '未回答'}

導入検討時期・予算感:
${budget_timing || '未回答'}
`;

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }]
    });

    const raw = message.content[0].text.trim();
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const result = JSON.parse(jsonStr);

    res.status(200).json(result);
  } catch (err) {
    console.error('Diagnose error:', err);
    res.status(500).json({ error: '診断処理中にエラーが発生しました', detail: err.message });
  }
};
