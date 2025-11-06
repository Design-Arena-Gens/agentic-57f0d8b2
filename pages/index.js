import { useEffect, useMemo, useState } from 'react';

export default function Home() {
  const [providers, setProviders] = useState({});
  const [selected, setSelected] = useState({});
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data) => {
        setProviders(data.providers || {});
        const defaultSel = Object.fromEntries(
          Object.entries(data.providers || {}).map(([k, v]) => [k, !!v])
        );
        setSelected(defaultSel);
      })
      .catch(() => setProviders({}));
  }, []);

  const available = useMemo(
    () => Object.entries(providers).filter(([, v]) => !!v).map(([k]) => k),
    [providers]
  );

  function toggle(name) {
    setSelected((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function generateVariant() {
    if (!message.trim()) return;
    const sentences = message.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    const hashtags = Array.from(
      new Set(
        message
          .toLowerCase()
          .match(/[a-z0-9]{4,}/g)
      )
    )
      .slice(0, 6)
      .map((w) => `#${w}`)
      .join(' ');
    const callToAction = 'Follow for more and share your thoughts!';
    setMessage(`${sentences.join(' ')}\n\n${hashtags}\n${callToAction}`);
  }

  async function onPost() {
    setError('');
    setResults([]);
    const chosen = Object.entries(selected)
      .filter(([k, v]) => v && providers[k])
      .map(([k]) => k);
    if (chosen.length === 0) {
      setError('Select at least one connected network.');
      return;
    }
    if (!message.trim()) {
      setError('Write something to post.');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, providers: chosen }),
      });
      const data = await res.json();
      setResults(data.results || []);
      if (!res.ok) setError(data.error || 'Failed to post.');
    } catch (e) {
      setError('Network error while posting.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '40px auto', padding: 16 }}>
      <h1>Agentic Social Poster</h1>
      <p>Compose once, post everywhere. Configure connections via environment variables.</p>

      <section style={{ marginTop: 24 }}>
        <h3>Connected Networks</h3>
        {available.length === 0 ? (
          <p>No networks configured yet. Set environment variables and redeploy.</p>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {available.map((name) => (
              <label
                key={name}
                style={{ border: '1px solid #ddd', padding: '8px 12px', borderRadius: 8 }}
              >
                <input
                  type="checkbox"
                  checked={!!selected[name]}
                  onChange={() => toggle(name)}
                  style={{ marginRight: 8 }}
                />
                {name}
              </label>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Message</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          style={{ width: '100%', fontSize: 16, padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
          placeholder="Share your update..."
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={generateVariant} disabled={!message.trim()}>
            Generate variant
          </button>
          <button onClick={onPost} disabled={posting || available.length === 0}>
            {posting ? 'Posting?' : 'Post to selected'}
          </button>
        </div>
      </section>

      {error && (
        <div style={{ marginTop: 16, color: 'crimson' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {results.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3>Results</h3>
          <ul>
            {results.map((r, idx) => (
              <li key={idx}>
                <strong>{r.provider}:</strong> {r.ok ? 'Success' : 'Failed'}
                {r.url ? (
                  <>
                    {' '}
                    <a href={r.url} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </>
                ) : null}
                {!r.ok && r.error ? <span> ? {r.error}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: 48, fontSize: 13, color: '#555' }}>
        <h3>Setup</h3>
        <p>
          Configure <code>.env</code> with any of the following and redeploy:
        </p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>
BLUESKY_IDENTIFIER=your-handle-or-email
BLUESKY_APP_PASSWORD=your-app-password
MASTODON_INSTANCE=mastodon.social
MASTODON_ACCESS_TOKEN=your-access-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
        </pre>
      </section>
    </div>
  );
}
