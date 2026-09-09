// Discord Webhook への通知。1メッセージ2000文字制限があるため長文は分割する。

async function sendDiscord(webhookUrl, content) {
  if (!webhookUrl) {
    console.log('[notify] DISCORD_WEBHOOK_URL 未設定。コンソールに出力します:\n' + content);
    return;
  }

  const chunks = splitMessage(content, 1900);
  for (const chunk of chunks) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Discord webhook failed: ${res.status} ${text}`);
    }
  }
}

function splitMessage(content, maxLen) {
  if (content.length <= maxLen) return [content];
  const chunks = [];
  let rest = content;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('\n', maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

module.exports = { sendDiscord };
