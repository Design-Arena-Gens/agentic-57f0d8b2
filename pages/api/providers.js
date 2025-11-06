export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const providers = {
    bluesky: !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD),
    mastodon: !!(process.env.MASTODON_INSTANCE && process.env.MASTODON_ACCESS_TOKEN),
    slack: !!process.env.SLACK_WEBHOOK_URL,
    discord: !!process.env.DISCORD_WEBHOOK_URL,
  };
  return res.status(200).json({ providers });
}
