// book.js — 予約受付エンドポイント
// Google Sheets連携: GOOGLE_SHEETS_WEBHOOK_URL 環境変数にGAS WebhookURLを設定
// メール通知: NOTIFY_EMAIL_WEBHOOK に対応Webhookを設定（Zapier/Make等）

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
    const {
      company,
      name,
      email,
      phone,
      position,
      preferred_date,
      preferred_time,
      diagnosis_score,
      diagnosis_grade,
      message: userMessage
    } = req.body;

    if (!name || !email || !company) {
      res.status(400).json({ error: '必須項目が不足しています（氏名・メール・会社名）' });
      return;
    }

    const timestamp = new Date().toISOString();
    const bookingData = {
      timestamp,
      company,
      name,
      email,
      phone: phone || '',
      position: position || '',
      preferred_date: preferred_date || '',
      preferred_time: preferred_time || '',
      diagnosis_score: diagnosis_score || '',
      diagnosis_grade: diagnosis_grade || '',
      message: userMessage || '',
      status: '未対応'
    };

    // Google Sheets webhook (GAS)
    const sheetsWebhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (sheetsWebhook) {
      try {
        await fetch(sheetsWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });
      } catch (e) {
        console.warn('Sheets webhook failed:', e.message);
      }
    }

    // Slack / Make / Zapier 通知
    const notifyWebhook = process.env.NOTIFY_EMAIL_WEBHOOK;
    if (notifyWebhook) {
      try {
        const slackText = `📋 新規予約申込\n会社: ${company}\n担当: ${name}（${position}）\nメール: ${email}\n希望日時: ${preferred_date} ${preferred_time}\n診断スコア: ${diagnosis_score}点 (${diagnosis_grade})\nメッセージ: ${userMessage}`;
        await fetch(notifyWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: slackText, data: bookingData })
        });
      } catch (e) {
        console.warn('Notify webhook failed:', e.message);
      }
    }

    res.status(200).json({
      success: true,
      booking_id: `NX-${Date.now()}`,
      message: '予約申込を受け付けました。担当者より2営業日以内にご連絡いたします。'
    });

  } catch (err) {
    console.error('Book error:', err);
    res.status(500).json({ error: '予約処理中にエラーが発生しました' });
  }
};
