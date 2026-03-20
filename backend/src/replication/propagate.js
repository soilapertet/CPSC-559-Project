// Leader broadcasts write operations to all follower nodes (fire-and-forget).
// Followers apply the same operation to their own databases via POST /replicate.

import { config } from "dotenv";

export async function propagateToFollowers(operation, data) {
  if (config.role !== 'leader') return;

  const urls = config.followers.filter(Boolean);

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
