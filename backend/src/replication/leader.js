// Leader broadcasts write operations to all follower nodes (fire-and-forget).
// Followers apply the same operation to their own databases via POST /replicate.
import { config } from "../config/config.js";
import { notifyFrontend } from "../routes/eventRoute.js";

// Import OperationLog schema to handle db operations
import OperationLog from "../models/OperationLog.js";

const TIMEOUT = 1000;                                       // wait for 1 second to receive response from follower
const MAX_RETRIES = 3;                                      // number of attempts to check follower's status
const BACKOFF_MULTIPLIER = 2;                               // double the timeout period with each attempt

// Create a map to keep track of followers' status
const followerStatus = new Map();

// Initialize a variable to store latest sequence number read from MongoDB
let seq = 0;

// Get active followers
export function getFollowerStatus() {
    return followerStatus;
}

// Read last sequence number stored in DB  on startup
export async function initializeSeq() {

    // Get the latest write operation log added to db
    const lastLog = await OperationLog.findOne().sort({ seq: -1 });

    // Update last sequence number accordingly
    seq = lastLog ? lastLog.seq : 0;
    console.log(`Last sequence number : ${seq}`);

    return seq;
}

// Create a new log entry and save it to the db
export async function logOperation(operation, data) {

    // Retrieve last applied sequence from operation_logs collections
    let lastAppliedLog = await OperationLog.findOne().sort({ seq : -1 });
    seq = lastAppliedLog ? lastAppliedLog.seq : 0;

    // Increment the sequence number
    seq++;
    console.log(`Current sequence number: ${seq}`);

    try {
        // Create and save a new operation log entry to db
        await OperationLog.create({
            seq,
            operation,
            data,
        });

        return seq;

    } catch (err) {
        console.log(`Error occured while logging ${operation} operation: ${err}`);
    }

};

// Initialize all followers' status to alive and retries to 0
export function initializeFollowerStatus() {
    config.nodes.map((url) => {
        followerStatus.set(url, { alive: true, retries: 0 })
    });
}


// Logic to remove dead follower from node list
function handleDeadFollower(deadUrl, port) {

    // Check if we've already notified the frontend of the dead node
    const prev = followerStatus.get(deadUrl);

    if (prev && prev.alive === false) {
        return;
    }

    // Mark follower node as dead
    followerStatus.set(deadUrl, { alive: false, retries: MAX_RETRIES });

    
    // Notify frontend of dead follower
    // Named event: follower-dead
    // Pass url of dead follower
    notifyFrontend({
        type: 'follower-dead',
        url: deadUrl,
    });

}

async function handleRecoveredNode(recoveredUrl) {

    try {
        const res = await fetch(`${recoveredUrl}/sync/sync-request`, {
            method: 'POST',
            headers: {
                'Content-type': 'application/json'
            }
        });

        if (!res.ok) {
            let errorMessage = `Sync request failed: ${res.status}`;

            try {
                const data = await res.json();
                if (data?.error) {
                    errorMessage = data.error;
                }
            } catch {
                // response wasn't JSON
            }

            throw new Error(`[RECOVERED NODE ${config.port}] ${errorMessage}`);
        }

        // Notify frontend of recovered follower
        // Named event: follower-recovered
        // Pass url of recovered node
        notifyFrontend({
            type: 'follower-recovered',
            url: recoveredUrl,
        });

    } catch (err) {
        console.error(`[Leader] Failed to sync ${recoveredUrl}: ${err.message}`);
    }

}

export async function propagateToFollowers(operation, data) {

    if (config.role !== 'leader') return;

    // Get the current follower nodes
    const followers = config.nodes.filter(url => {
        const port = new URL(url).port;
        return port != String(config.port);
    });

    // Get the active follower nodes
    const activeURLS = followers.filter(url => followerStatus.get(url)?.alive);

    //  Log write operation to local db before propagating to followers 
    const seq = await logOperation(operation, data);

    // Implement synchronous replication to ensure all operations have been applied
    // to the follower nodes before sending confirmation to the user
    const results = await Promise.allSettled(
        activeURLS.map((url) =>
            fetch(`${url.trim()}/replicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation,
                    data,
                    seq,
                    timestamp: new Date().toISOString()
                })
            }).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res;
            })
        )
    );

    // Quorum calculation
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const N = activeURLS.length;
    const W = Math.floor(N / 2) + 1;

    // Throw error if ACKs received is less than quorum threshold
    console.log(`[Leader] seq ${seq}: Received ${successCount}/${N} ACKs. Quorum (W) is ${W}.`);
    if (successCount < W) {
        throw new Error(`Replication failed: Only ${successCount}/${W} ACKs received.`);
    }

}

// Ping Follower node to check health status
export async function pingFollower(url, retryCount = 0, delay = TIMEOUT) {

    // Extract port number from url
    const port = new URL(url).port;

    // Get node's current status
    const prev = followerStatus.get(url);

    try {

        // Check health endpoint of follower node
        await fetch(`${url}/health`, {
            // Start timer to wait for response from follower node
            signal: AbortSignal.timeout(delay)
        })

        // Mark as alive in status map once follower responds with an 'alive' status
        followerStatus.set(url, { alive: true, retries: 0 });

        // Check if ping came from a dead node that has recovered after a crash
        if (prev && prev.alive === false) {
            console.log(`[Leader] Node ${port} RECOVERED. Triggering syncing.`);
            await handleRecoveredNode(url);
        }

    } catch {

        // Ping follower again if retry count is less than maximum retries
        if (retryCount < MAX_RETRIES - 1) {

            // Wait before re-sending heartbeat signal
            await new Promise(resolve => setTimeout(resolve, delay));

            // Progressively increase delay time after sending heartbeat signal to follower node
            return pingFollower(url, retryCount + 1, delay * BACKOFF_MULTIPLIER);
        }

        // Maximum retries have been hit -> Follower node is dead
        handleDeadFollower(url, port);
    }
}

// Send heartbeats to all follower nodes (dead and alive nodes)
// Allows us to apply node recovery logic
export async function sendHeartbeats() {

    // Get the current follower nodes
    const followers = config.nodes.filter(url => {
        const port = new URL(url).port;
        return port != String(config.port);
    });

    await Promise.allSettled(followers.map(url => pingFollower(url)));
}