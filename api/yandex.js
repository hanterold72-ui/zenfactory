export default async function handler(req, res) {
  const b = req.body || {};
  const key = b.key, folder = b.folder, model = b.model, prompt = b.prompt;
  if (!key || !folder) return res.status(400).json({ error: 'Нет ключа или Folder ID' });
  const H = { 'Content-Type': 'application/json', 'Authorization': 'Api-Key ' + key, 'x-folder-id': folder };
  try {
    if (b.kind === 'text') {
      let r, j;
      if (String(model).indexOf('deepseek') === 0 || String(model).indexOf('qwen') === 0) {
        r = await fetch('https://ai.api.cloud.yandex.net/v1/chat/completions', { method: 'POST', headers: H, body: JSON.stringify({ model: model, messages: [{ role: 'user', content: prompt }], max_tokens: 2000, temperature: 0.7 }) });
        j = await r.json();
        if (!r.ok) return res.status(r.status).json({ error: (j.error && j.error.message) || j.message || ('HTTP ' + r.status) });
        return res.json({ text: (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '' });
      }
      r = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', { method: 'POST', headers: H, body: JSON.stringify({ modelUri: 'gpt://' + folder + '/' + model, completionOptions: { stream: false, temperature: 0.7, maxTokens: '2000' }, messages: [{ role: 'user', text: prompt }] }) });
      j = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: j.message || ('HTTP ' + r.status) });
      return res.json({ text: (j.result && j.result.alternatives && j.result.alternatives[0] && j.result.alternatives[0].message && j.result.alternatives[0].message.text) || '' });
    }
    const r = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync', { method: 'POST', headers: H, body: JSON.stringify({ modelUri: 'art://' + folder + '/' + model, messages: [{ text: prompt, weight: 1 }], generationOptions: { mimeType: 'image/png' } }) });
    const st = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: st.message || ('HTTP ' + r.status) });
    for (let i = 0; i < 30; i++) {
      await new Promise(s => setTimeout(s, 2000));
      const or = await fetch('https://llm.api.cloud.yandex.net/operations/' + st.id, { headers: H });
      const op = await or.json();
      if (op.done) return res.json({ data: op.response && op.response.image && op.response.image.data });
      if (op.error) return res.status(500).json({ error: op.error.message });
    }
    return res.status(500).json({ error: 'Таймаут генерации' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
