// ================== Code Credit: Abdullah Ishtiaq ==================

// Leader broadcasts write operations to all follower nodes (fire-and-forget).
// Followers apply the same operation to their own databases via POST /replicate.
import { config } from "../config/config.js";

const URLS = config.followers.filter(Boolean);

export async function propagateToFollowers(operation, data) {
    
    if (config.role !== 'leader') return;

    // Implement synchronous replication to ensure all operations have been applied
    // to the follower nodes before sending confirmation to the user
    const result = await Promise.allSettled(
        URLS.map((url) => {
            fetch(`${url.trim()}/replicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation,
                    data,
                    timestamp: new Date().toISOString()
                })
            }).then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                console.log(`[Leader] Replicated '${operation}' to ${url}`)
                return res;
            })
        })
    );

    // Check if any followers failed to ensure strong consistency (consistency model subject to change)
    const failed = result.filter(r => r.status === 'rejected');
    if(failed.length > 0) {
        throw new Error(`Replication failed: ${failed.length} follower(s) did not ACK.`)
    }
}
