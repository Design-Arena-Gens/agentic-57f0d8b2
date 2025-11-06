import { AtpAgent } from '@atproto/api';

export const config = {
  api: {
    bodyParser: true,
  },
};

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

async function postToBluesky(text) {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) throw new Error('Bluesky not configured');

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({ identifier, password });
  const record = {
    $type: 'app.bsky.feed.post',
    text: ensureString(text).slice(0, 300),
    createdAt: new Date().toISOString(),
  };
  const res = await agent.api.app.bsky.feed.post.create(
    { repo: agent.session?.did },
    record
  );
  const uri = res?.data?.uri;
  let url;
  if (uri && typeof uri === 'string') {
    // uri format: at://did/app.bsky.feed.post/3k...r
    const parts = uri.split('/');
    const did = parts[2];
    const rkey = parts[4];
    if (did && rkey) {
      url = `https://bsky.app/profile/${did}/post/${rkey}`;
    }
  }
  return { ok: true, url };
}

async function postToMastodon(text) {
  const instance = process.env.MASTODON_INSTANCE;
  const token = process.env.MASTODON_ACCESS_TOKEN;
  if (!instance || !token) throw new Error('Mastodon not configured');

  const resp = await fetch(`https://${instance}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: ensureString(text) }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Mastodon error ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return { ok: true, url: data?.url };
}

async function postToSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error('Slack not configured');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: ensureString(text) }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Slack error ${resp.status}: ${t}`);
  }
  return { ok: true };
}

async function postToDiscord(text) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error('Discord not configured');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: ensureString(text) }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Discord error ${resp.status}: ${t}`);
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message, providers } = req.body || {};
  const text = ensureString(message).trim();
  const targets = Array.isArray(providers) ? providers : [];

  if (!text) return res.status(400).json({ error: 'Message is required' });
  if (targets.length === 0)
    return res.status(400).json({ error: 'No providers selected' });

  const tasks = targets.map(async (p) => {
    try {
      if (p === 'bluesky') return { provider: p, ...(await postToBluesky(text)) };
      if (p === 'mastodon') return { provider: p, ...(await postToMastodon(text)) };
      if (p === 'slack') return { provider: p, ...(await postToSlack(text)) };
      if (p === 'discord') return { provider: p, ...(await postToDiscord(text)) };
      return { provider: p, ok: false, error: 'Unknown provider' };
    } catch (e) {
      return { provider: p, ok: false, error: e?.message || 'Failed' };
    }
  });

  const results = await Promise.all(tasks);

  const anyOk = results.some((r) => r.ok);
  return res.status(anyOk ? 200 : 500).json({ results });
}
