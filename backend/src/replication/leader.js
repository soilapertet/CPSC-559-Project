// ================== Code Credit: Abdullah Ishtiaq ==================

// Leader broadcasts write operations to all follower nodes (fire-and-forget).
// Followers apply the same operation to their own databases via POST /replicate.
import { config } from "../config/config.js";

const URLS = config.followers.filter(Boolean);

const HEARTBEAT_INTERVAL = 2000;                            // ping followers after every 2 seconds
const TIMEOUT = 1000;                                       // wait for 1 second to receive response from follower
const MAX_RETRIES = 3;                                      // number of attempts to check follower's status
const BACKOFF_MULTIPLIER = 2;                               // double the timeout period with each attempt

// Create a map to keep track of followers' status
const followerStatus = new Map();

// Initialize all followers' status to alive
// Set alive to True
// Number of retries to 0
URLS.map((url) => {
    followerStatus.set(url, { alive: true, retries: 0 })
})


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
    if (failed.length > 0) {
        throw new Error(`Replication failed: ${failed.length} follower(s) did not ACK.`)
    }
}

// Ping Follower node to check health status
async function pingFollower(url, retryCount = 0, delay = TIMEOUT) {

    // Extract port number from url
    const port = new URL(url).port;

    try {

        // Check health endpoint of follower node
        await fetch(`${url}/health`, {
            // Start timer to wait for response from follower node
            signal: AbortSignal.timeout(delay)
        })

        // Mark as alive in status map once follower responds with an 'alive' status
        followerStatus.set(url, { alive: true, retries: 0 });
        console.log(`[Leader] Node ${port} is alive.`);

    } catch {
        console.warn(`[Leader] Node ${port} did not respond. Attempt: ${retryCount + 1}.`);

        // Ping follower again if retry count is less than maximum retries
        if (retryCount < MAX_RETRIES - 1) {

            // Wait before re-sending heartbeat signal
            await new Promise(resolve => setTimeout(resolve, delay));

            // Progressively increase delay time after sending heartbeat signal to follower node
            return pingFollower(url, retryCount + 1, delay * BACKOFF_MULTIPLIER);
        }

        // Maximum retries have been hit -> Follower node is dead
        followerStatus.set(url, { alive: false, retries: retryCount });
        console.error(`[Leader] Node ${port} is dead after ${MAX_RETRIES}.`);

    }
}

// Send heartbeats to all follower nodes
async function sendHeartbeats() {
    await Promise.allSettled(URLS.map(url => pingFollower(url)));
}

export async function startLeaderHeartbeat() {
    
    // Only send heartbeat if node is a leader
    if (config.role !== 'leader') return;

    // Start heartbeat loop
    setInterval(sendHeartbeats, HEARTBEAT_INTERVAL);
}
