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

export const syncFromLeader = async (leaderUrl) => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const res = await fetch(`${leaderUrl}/sync?from=${lastAppliedSeq}`);
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);

    const { data: missedLogs } = await res.json();

    for (const log of (missedLogs || [])) {
      console.log(`[Syncing Node ${config.port}] Processing seq: ${log.seq}`);

      await OperationLog.updateOne(
        { seq: log.seq },
        { $set: { ...log } },
        { upsert: true }
      );

      if (log.commited) {
        await executeOperation(log.seq, log.request_id, log.operation, log.data);
      }

      lastAppliedSeq = log.seq;
    }
    
    console.log(`[Sync] Finished. Current seq: ${lastAppliedSeq}`);
  } catch (err) {
    console.error(`[Sync] Error: ${err.message}`);
  } finally {
    isSyncing = false;
  }
};

const executeOperation = async (seq, request_id, operation, data) => {
  if (operation === 'createUser') {
    // Use findOneAndUpdate to prevent "Duplicate Key" errors on User model
    await User.findOneAndUpdate(
      { _id: data._id },
      { 
        firstName: data.firstName,
        lastName: data.lastName,
        userName: data.userName,
        email: data.email
      },
      { upsert: true }
    );
    console.log(`[Follower:${config.port}] Applied seq ${seq}: createUser`);
  }

  else if (operation === 'borrow') {
    await Book.findByIdAndUpdate(data.bookId, { $inc: { availableCopies: -1 } });
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
    console.log(`[Follower:${config.port}] Applied seq ${seq}: borrow`);
  }

  else if (operation === 'return') {
    await Transaction.findByIdAndUpdate(data.transactionId, {
      $set: { status: 'returned', returnedAt: new Date(data.returnedAt) }
    });
    await Book.findByIdAndUpdate(data.bookId, { $inc: { availableCopies: 1 } });
    console.log(`[Follower:${config.port}] Applied seq ${seq}: return`);
  }
};

const applyOperation = async (seq, request_id, operation, data) => {
  // 1. Duplicate check
  const existingWrite = await OperationLog.findOne({ request_id });
  if (existingWrite && existingWrite.committed) {
    console.log(`[Follower ${config.port}] Request ${request_id} already committed. Ignoring.`);
    return;
  }

  // 2. Old sequence check
  if (seq <= lastAppliedSeq) return;

  // 3. Gap Detection
  if (seq > lastAppliedSeq + 1) {
    console.log(`[Follower:${config.port}] Gap detected (${lastAppliedSeq} -> ${seq}). Queuing.`);
    pendingQueue.push({ seq, request_id, operation, data });
    pendingQueue.sort((a, b) => a.seq - b.seq);

    if (!isSyncing) {
      const leaderUrl = getLeaderUrl();
      if (leaderUrl) await syncFromLeader(leaderUrl);
    }
    return;
  }

  // 4. Execution
  try {
    await executeOperation(seq, request_id, operation, data);
    lastAppliedSeq = seq;

    // Use updateOne to mark the Phase 1 log as committed
    await OperationLog.updateOne(
      { seq },
      { $set: { committed: true, request_id, operation, data } },
      { upsert: true }
    );

    while (pendingQueue.length > 0 && pendingQueue[0].seq === lastAppliedSeq + 1) {
      const nextOp = pendingQueue.shift();
      console.log(`[Follower] Processing queued seq: ${nextOp.seq}`);
      await executeOperation(nextOp.seq, nextOp.request_id, nextOp.operation, nextOp.data);
      lastAppliedSeq = nextOp.seq;

      await OperationLog.updateOne(
        { seq: nextOp.seq },
        { $set: { committed: true, request_id: nextOp.request_id, operation: nextOp.operation, data: nextOp.data } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error(`[Follower] Error applying seq ${seq}: ${err.message}`);
    throw err;
  }
};

export const handleCommit = async (req, res) => {
  const { seq, request_id, operation, data } = req.body;

  try {
    console.log(`[Follower:${config.port}] Finalizing commit for seq: ${seq}`);
    await applyOperation(seq, request_id, operation, data);

    res.status(200).json({
      message: 'Committed',
      seq,
      port: config.port
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const handleReplicate = async (req, res) => {
  const { seq, request_id, operation, data, timestamp } = req.body;

  console.log(`[Follower:${config.port}] Received replication: '${operation}' at ${timestamp}`);

  try {
    await OperationLog.updateOne(
      { seq: Number(seq) }, 
      { 
        $set: { 
          request_id, 
          operation, 
          data,
          timestamp: timestamp,
          committed: false
        } 
      },
      { upsert: true }
    );

    console.log(`[Follower:${config.port}] Logged seq ${seq} (Pending). Sending ACK.`);

    res.status(200).json({
      message: 'ACK',
      seq,
      request_id,
      port: config.port
    });

  } catch (err) {
    console.error(`[Follower:${config.port}] Replication Log Error: ${err.message}`);
    res.status(500).json({ error: "Failed to log operation" });
  }
};
