const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    company, name, email, phone, position,
    preferred_date, preferred_time, message,
    diagnosis_score, diagnosis_grade
  } = req.body;

  if (!name || !email || !preferred_date || !preferred_time) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  try {
    // サービスアカウント認証
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // 予約日時の組み立て
    const [year, month, day] = preferred_date.split('-').map(Number);
    const [hour, minute] = preferred_time.split(':').map(Number);
    const startTime = new Date(year, month - 1, day, hour, minute);
    const endTime   = new Date(year, month - 1, day, hour + 1, minute);

    const toISO = d => d.toISOString();

    // カレンダーに予定を作成
    const event = await calendar.events.insert({
      calendarId: 'info.nexccess@gmail.com',
      sendUpdates: 'all',
      requestBody: {
        summary: `【予約】${company || ''} ${name}様`,
        description: [
          `会社名: ${company || '未回答'}`,
          `氏名: ${name}`,
          `メール: ${email}`,
          `電話: ${phone || '未回答'}`,
          `役職: ${position || '未回答'}`,
          `診断スコア: ${diagnosis_score || '—'}点 (${diagnosis_grade || '—'})`,
          `メッセージ: ${message || 'なし'}`,
        ].join('\n'),
        start: { dateTime: toISO(startTime), timeZone: 'Asia/Tokyo' },
        end:   { dateTime: toISO(endTime),   timeZone: 'Asia/Tokyo' },
        attendees: [
          { email: 'info.nexccess@gmail.com' },
          { email }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      }
    });

    // GASにも記録
    const gasUrl = process.env.GAS_WEBHOOK_URL;
    if (gasUrl) {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'booking',
          timestamp: new Date().toISOString(),
          company, name, email, phone, position,
          preferred_date, preferred_time,
          diagnosis_score, diagnosis_grade,
          message,
          event_id: event.data.id
        })
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      booking_id: `NX-${Date.now()}`,
      event_id: event.data.id,
      message: '予約を受け付けました。担当者より確認のご連絡をいたします。'
    });

  } catch (err) {
    console.error('Book error:', err);
    return res.status(500).json({ error: '予約処理中にエラーが発生しました', detail: err.message });
  }
};
