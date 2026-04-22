// Leader broadcasts write operations to all follower nodes (fire-and-forget).
// Followers apply the same operation to their own databases via POST /replicate.
import { config } from "../config/config.js";
import { notifyFrontend } from "../routes/eventRoute.js";

// Import OperationLog schema to handle db operations
import OperationLog from "../models/OperationLog.js";
import Counter from "../models/Counter.js";

const TIMEOUT = 1000;                                       // wait for 1 second to receive response from follower
const MAX_RETRIES = 3;                                      // number of attempts to check follower's status
const BACKOFF_MULTIPLIER = 2;                               // double the timeout period with each attempt

// Create a map to keep track of followers' status
const followerStatus = new Map();

// Get active followers
export function getFollowerStatus() {
    return followerStatus;
}

// Create a new log entry and save it to the db
export async function logOperation(request_id, operation, data) {

    try {

        //  Before logging new write operation, check if it's the same request
        const existingWriteOp = await OperationLog.findOne({ request_id });

        if (existingWriteOp) {
            if (existingWriteOp.committed) {
                return {
                    seq: existingWriteOp.seq,
                    committed: true
                };
            } else {
                // return sequence number if this is a retry write operation
                console.log(`[Leader] Retrying uncommitted write request ${request_id}`);
                return {
                    seq: existingWriteOp.seq,
                    committed: false
                };
            }
        }

        // Increment the sequence number
        const seq = await getNextSeq();
        console.log(`Current sequence number: ${seq}`);

        // Create and save a new operation log entry to db
        await OperationLog.create({
            seq,
            request_id,
            operation,
            data,
            committed: false,
        });

        return {
            seq, 
            committed: false
        };

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

// Initialize a counter that is linked to the sequence number
export async function initializeCounter() {

    const lastAppliedLog = await OperationLog.findOne().sort({ seq: -1 });
    const lastAppliedSeq = lastAppliedLog ? lastAppliedLog.seq : 0;

    await Counter.findOneAndUpdate(
        { _id: "operation_log_seq" },
        { $set: { value: lastAppliedSeq } },
        { upsert: true }                       // creates if it doesn't exist
    )

    console.log(`Sequence number initialized: ${lastAppliedSeq}.`);

}

// Create a function to safely increment the sequence number
export async function getNextSeq() {

    const result = await Counter.findOneAndUpdate(
        { _id: "operation_log_seq" },
        { $inc: { value: 1 } },
        { returnDocument: "after", upsert: true }
    );

    return result.value;
}

// Define a function to mark the write operation as committed once the leader has received an ACK from the majority
export async function markCommitted(seq) {
    await OperationLog.updateOne(
        { seq },
        { $set: { committed: true } }
    );

    console.log(`[Leader] Sequence Number ${seq} marked as COMMITTED.`);
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

export async function checkQuorum(request_id, operation, data) {
    const lastAppliedLog = await OperationLog.findOne().sort({ seq: -1 });
    const mySeq = lastAppliedLog ? lastAppliedLog.seq : 0;

    const followers = config.nodes.filter(url => {
        const port = new URL(url).port;
        return port != String(config.port);
    });

    const activeFollowers = followers.filter(url => followerStatus.get(url)?.alive);

    const results = await Promise.allSettled(
        activeFollowers.map(url => 
            fetch(`${url.trim()}/replicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seq, request_id, operation, data, timestamp: new Date().toISOString() }),
                signal: AbortSignal.timeout(1000) // Don't wait forever
            }).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
        )
    );

    const acks = results.filter(r => r.message === 'ACK').length + 1;
    const N = activeFollowers.length + 1;
    const W = floor(N/2) + 1;

    console.log(`[Leader] seq ${seq}: Received ${totalSuccessCount}/${N} ACKs. Quorum is ${W}.`);
    
    if (acks >= W) {
        return {
            success: true,
            seq,
            acks: acks,
            urls: activeFollowers
        }
    } else {
        return {
            success: false,
            seq,
            acks: acks,
            error: 'Quorum not achieved.'
        }
    }
}

export async function propagateToFollowers(request_id, operation, data) {
    if (config.role !== 'leader') return;

    const { seq, committed } = await logOperation(request_id, operation, data);

    if (committed) {
        return { seq };
    }

    // This sends the /replicate calls and waits for ACKs
    const quorumResult = await checkQuorum(request_id, operation, data, seq);

    if (!quorumResult.success) {
    console.error(`[Leader] Quorum failed for seq ${seq}: ${quorumResult.error}`);
        throw new Error(quorumResult.error);
    } else {
        console.log(`[Leader] Quorum achieved for seq ${seq}. Proceeding to commit.`);

        await markCommitted(seq);

        // We fire-and-forget the commit or wait for them
        Promise.allSettled(
            quorumResult.urls.map(url => 
                fetch(`${url.trim()}/replicate/commit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seq, request_id, operation, data })
                })
            )
        );

        return { seq };
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