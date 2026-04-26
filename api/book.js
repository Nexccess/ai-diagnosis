const { GoogleAuth } = require('google-auth-library');

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
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const [year, month, day] = preferred_date.split('-').map(Number);
    const [hour, minute] = preferred_time.split(':').map(Number);
    const start = new Date(year, month - 1, day, hour, minute);
    const end   = new Date(year, month - 1, day, hour + 1, minute);

    const toJST = d => {
      const offset = 9 * 60;
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000 + offset * 60000);
      return local.toISOString().replace('Z', '+09:00');
    };

    const event = {
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
      start: { dateTime: toJST(start), timeZone: 'Asia/Tokyo' },
      end:   { dateTime: toJST(end),   timeZone: 'Asia/Tokyo' },
      attendees: [
        { email: 'info.nexccess@gmail.com' },
        { email }
      ]
    };

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/info.nexccess%40gmail.com/events?sendUpdates=all',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );

    if (!calRes.ok) {
      const err = await calRes.json();
      throw new Error(err.error?.message || 'Calendar API error');
    }

    const calData = await calRes.json();

    // GAS記録
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
          message, event_id: calData.id
        })
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      booking_id: `NX-${Date.now()}`,
      message: '予約を受け付けました。'
    });

  } catch (err) {
    console.error('Book error:', err);
    return res.status(500).json({ error: '予約処理中にエラーが発生しました', detail: err.message });
  }
};
