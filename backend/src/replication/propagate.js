// Leader broadcasts write operations to all follower nodes (fire-and-forget).
// Followers apply the same operation to their own databases via POST /replicate.

export async function propagateToFollowers(operation, data) {
  if (process.env.NODE_ROLE !== 'leader') return;

  const urls = (process.env.FOLLOWER_URLS || '').split(',').filter(Boolean);

  for (const url of urls) {
    fetch(`${url.trim()}/replicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation,
        data,
        timestamp: new Date().toISOString()
      })
    })
      .then(() => console.log(`[Leader] Replicated '${operation}' to ${url}`))
      .catch(err => console.warn(`[Leader] Failed to replicate '${operation}' to ${url}: ${err.message}`));
  }
}
