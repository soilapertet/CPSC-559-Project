// ================== Code Credit: Abdullah Ishtiaq ==================

// Handles incoming replication payloads from the leader.
// Re-applies the same DB operation on this follower's own database,
// using the same _id values as the leader to ensure ID consistency across nodes.

import { config } from '../config/config.js';

import Book from '../models/Book.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const leader_url = config.leader.url;                       // leader's URL

const HEARTBEAT_INTERVAL = 2000;                            // ping followers after every 2 seconds
const TIMEOUT = 1000;                                       // wait for 1 second to receive response from follower
const MAX_RETRIES = 3;                                      // number of attempts to check follower's status
const BACKOFF_MULTIPLIER = 2;                               // double the timeout period with each attempt

export const handleReplicate = async (req, res) => {

  const { operation, data, timestamp } = req.body;

  console.log(`[Follower:${config.port}] Received replication: '${operation}' at ${timestamp}`);

  try {
    if (operation === 'createUser') {
      // Create user with the same _id as the leader so userId references stay consistent
      await User.create({
        _id: data._id,
        firstName: data.firstName,
        lastName: data.lastName,
        userName: data.userName,
        email: data.email
      });
      console.log(`[Follower:${config.port}] Applied: createUser (${data.userName})`);
    }

    else if (operation === 'borrow') {
      // Decrement availableCopies on this node's book
      await Book.findByIdAndUpdate(data.bookId, { $inc: { availableCopies: -1 } });

      // Create transaction with the same _id as the leader
      await Transaction.create({
        _id: data.transactionId,
        userId: data.userId,
        bookId: data.bookId,
        status: 'borrowed',
        dueDate: new Date(data.dueDate)
      });
      console.log(`[Follower:${config.port}] Applied: borrow (book ${data.bookId})`);
    }

    else if (operation === 'return') {
      // Update transaction status
      await Transaction.findByIdAndUpdate(data.transactionId, {
        status: 'returned',
        returnedAt: new Date(data.returnedAt)
      });

      // Increment availableCopies on this node's book
      await Book.findByIdAndUpdate(data.bookId, { $inc: { availableCopies: 1 } });
      console.log(`[Follower:${config.port}] Applied: return (book ${data.bookId})`);
    }

    else {
      console.warn(`[Follower:${config.port}] Unknown operation: ${operation}`);
    }

    res.status(200).json({
      message: 'ACK',
      operation,
      port: config.port
    });

  } catch (err) {
    console.error(`[Follower:${config.port}] Replication error for '${operation}': ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

async function pingLeader(url, retryCount = 0, delay = TIMEOUT) {

  // Get the port the leader is running on
  const port = new URL(url).port;

  try {
    await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(delay)
    });

    console.log(`[Node ${config.port}] Leader is alive.`)
  } catch {

    console.warn(`[Node ${config.port}] Leader did not respond. Attempt: ${retryCount + 1}.`)

    if (retryCount < MAX_RETRIES - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return pingLeader(url, retryCount + 1, delay * BACKOFF_MULTIPLIER);
    }

    console.warn(`[Node ${config.port}] Leader is dead after ${MAX_RETRIES} attempts.`);
    // Initiate leader election
  }
}

async function sendHeartbeat() {
  await pingLeader(leader_url);
}

// Start hearbeat loop
export async function startFollowerHeartbeat() {

  // Only send heartbeat if node is a follower
  if (config.role != 'follower') return;

  // Start heartbeat loop
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}
