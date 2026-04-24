// Handles incoming replication payloads from the leader.
// Re-applies the same DB operation on this follower's own database,
// using the same _id values as the leader to ensure ID consistency across nodes.

import { config } from '../config/config.js';

import Book from '../models/Book.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import OperationLog from '../models/OperationLog.js';
import { getLeaderUrl } from './bullyElection.js';
let lastAppliedSeq = 0;
let pendingQueue = [];

// Add flag to keep track of syncing status
let isSyncing = false;

// Retrieve the last applied write operation and its corresponding write operation
export async function initializeFollowerState() {
  const lastAppliedLog = await OperationLog.findOne().sort({ seq: -1 });
  lastAppliedSeq = lastAppliedLog ? lastAppliedLog.seq : 0;

  console.log(`[Follower:${config.port}] Initialized lastAppliedSeq = ${lastAppliedSeq}`);
}

// Sync uncommitted or missed operations
export const syncFromLeader = async (leaderUrl) => {

  // Check if node is currently syncing
  if (isSyncing) {
    console.log(`[Syncing Node ${config.port}] Currently syncing, skipping request.`);
    return;
  }

  // Set isSyncing flag to true
  isSyncing = true;

  try {

    console.log(`[DEBUG] LAST APPLIED SEQ: ${lastAppliedSeq}`);
    console.log(`[DEBUG] SYNC URL: ${leaderUrl}/sync?from=${lastAppliedSeq}`);

    // Fetch missed and uncommitted operations from current leader
    const res = await fetch(`${leaderUrl}/sync?from=${lastAppliedSeq}`);

    if (!res.ok) {
      throw new Error(`Error occured while fetching missed logs from Leader ${leaderUrl}: ${res.status}`);
    }

    const response = await res.json();
    const missedLogs = response.data;
    console.log(`[DEBUG] # OF MISSED LOGS: ${missedLogs.length}`)

    for (const log of missedLogs) {

      // Apply each missed operation
      try {

        console.log(`[Syncing Node ${config.port} Applying seq: ${log.seq}]`);
        await applyOperation(log.seq, log.request_id, log.operation, log.data);
        console.log(`[Syncing Node ${config.port}] Successfully applied missed operation. Applied seq: ${log.seq}`);

      } catch (err) {
        throw new Error(`Error occured while applying seq ${log.seq}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`[Syncing Node ${config.port}] Sync failed: ${err.message}`);
    throw err;
  } finally {
    isSyncing = false;
  }
}

const executeOperation = async (seq, request_id, operation, data) => {
  if (operation === 'createUser') {

    // Create user with the same _id as the leader so userId references stay consistent
    await User.create({
      _id: data._id,
      firstName: data.firstName,
      lastName: data.lastName,
      userName: data.userName,
      email: data.email
    });

    console.log(`[Follower:${config.port}] Applied seq ${seq}: createUser (${data.userName})`);
    console.log(`[Follower:${config.port}] Applied seq ${seq}: Logged new operation (${operation})`);
  }

  else if (operation === 'borrow') {
    // Decrement availableCopies on this node's book
    await Book.findByIdAndUpdate(data.bookId, { $inc: { availableCopies: -1 } });

    // Create transaction with the same _id as the leader
    await Transaction.updateOne(
      { _id: data.transactionId },
      {
        $set: {
          userId: data.userId,
          bookId: data.bookId,
          status: 'borrowed',
          dueDate: new Date(data.dueDate)
        }
      },
      { upsert: true }
    );

    console.log(`[Follower:${config.port}] Applied seq ${seq}: borrow (book ${data.bookId})`);
    console.log(`[Follower:${config.port}] Applied seq ${seq}: Logged new operation (${operation})`);

  }

  else if (operation === 'return') {
    // Update transaction status
    await Transaction.findByIdAndUpdate(data.transactionId, {
      status: 'returned',
      returnedAt: new Date(data.returnedAt)
    });

    // Increment availableCopies on this node's book
    await Book.findByIdAndUpdate(data.bookId, { $inc: { availableCopies: 1 } });

    console.log(`[Follower:${config.port}] Applied seq ${seq}: return (book ${data.bookId})`);
    console.log(`[Follower:${config.port}] Applied seq ${seq}: Logged new operation (${operation})`);

  }

  else {
    console.warn(`[Follower:${config.port}] Unknown operation: ${operation}`);
  }

}

const applyOperation = async (seq, request_id, operation, data) => {
  console.log(`[DEBUG] Last Applied Sequence Number: ${lastAppliedSeq}`);
  console.log(`[DEBUG] Circulating Sequence Number: ${seq}`);

  // Execute operations with existing log that haven't been committed
  const existingSeq = await OperationLog.findOne({ seq });
  if (existingSeq) {
    if (existingSeq.committed) {
      console.log(`[Follower:${config.port}] Seq ${seq} already committed. Skipping.`);
      return;
    }

    console.log(`[Follower:${config.port}] Fixing uncommitted seq ${seq}`);

    await executeOperation(seq, request_id, operation, data);

    await OperationLog.updateOne(
      { seq },
      {
        $set: {
          request_id,
          operation,
          data,
          committed: true
        }
      }
    );

    lastAppliedSeq = Math.max(lastAppliedSeq, seq);
    return;
  }
  
  // Check if operation wasn't applied, add to queue and sort by sequence number
  if (seq > lastAppliedSeq + 1) {
    console.log(`[Follower:${config.port}] Gap detected. Queuing seq: ${seq}`);
    pendingQueue.push({ seq, request_id, operation, data });
    pendingQueue.sort((a, b) => a.seq - b.seq);

    // Sync follower node with leader since a gap is detected in the write operation
    if (!isSyncing) {
      const leaderUrl = getLeaderUrl();
      await syncFromLeader(leaderUrl);
    }

    return;
  }

  // Apply current operation
  try {
    console.log(`[Follower:${config.port} Applying seq: ${seq}]`);
    await executeOperation(seq, request_id, operation, data);
    lastAppliedSeq = seq;

    console.log("[DEBUG] LOGGING IN MISSED WRITE OPERATION. ");

    // Create and save a new operation log entry to db and mark write operation as committed
    await OperationLog.create({
      seq,
      request_id,
      operation,
      data,
      committed: true,
    });

    // Check if pending queue has next sequences
    while (pendingQueue.length > 0 && pendingQueue[0].seq === lastAppliedSeq + 1) {
      const nextOp = pendingQueue.shift();
      console.log(`[Follower:${config.port}] Applying queued seq: ${nextOp.seq}`);
      await executeOperation(nextOp.seq, nextOp.request_id, nextOp.operation, nextOp.data);
      lastAppliedSeq = nextOp.seq;

      // Create and save a new operation log entry to db and mark write operation as committed
      await OperationLog.create({
        seq: nextOp.seq,
        request_id: nextOp.request_id,
        operation: nextOp.operation,
        data: nextOp.data,
        committed: true
      });

    }
  } catch (err) {
    console.error(`[Follower:${config.port}] Error applying seq ${seq}: ${err.message}`);
    throw err;
  }

}

export const handleReplicate = async (req, res) => {
  const { seq, request_id, operation, data, timestamp } = req.body;

  console.log(`[Follower:${config.port}] Received replication: '${operation}' at ${timestamp}`);

  try {
    await applyOperation(seq, request_id, operation, data);

    res.status(200).json({
      message: 'ACK',
      seq,
      request_id,
      operation,
      port: config.port
    });
  } catch (err) {
    console.error(`[Follower:${config.port}] Replication error for '${operation}': ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};
