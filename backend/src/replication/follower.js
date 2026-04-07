// ================== Code Credit: Abdullah Ishtiaq ==================

// Handles incoming replication payloads from the leader.
// Re-applies the same DB operation on this follower's own database,
// using the same _id values as the leader to ensure ID consistency across nodes.

import { config } from '../config/config.js';

import Book from '../models/Book.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import OperationLog from '../models/OperationLog.js';

let lastAppliedSeq = 0;
let pendingQueue = [];

// Add flag to keep track of syncing status
let isSyncing = false;

const executeOperation = async (operation, seq, data) => {
  if (operation === 'createUser') {

    // Create user with the same _id as the leader so userId references stay consistent
    await User.create({
      _id: data._id,
      firstName: data.firstName,
      lastName: data.lastName,
      userName: data.userName,
      email: data.email
    });

    // Create and save a new operation log entry to db
    await OperationLog.create({
      seq,
      operation,
      data,
    });

    console.log(`[Follower:${config.port}] Applied seq ${seq}: createUser (${data.userName})`);
    console.log(`[Follower:${config.port}] Applied seq ${seq}: Logged new operation (${operation})`);
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

    // Create and save a new operation log entry to db
    await OperationLog.create({
      seq,
      operation,
      data,
    });

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

    // Create and save a new operation log entry to db
    await OperationLog.create({
      seq,
      operation,
      data,
    });

    console.log(`[Follower:${config.port}] Applied seq ${seq}: return (book ${data.bookId})`);
    console.log(`[Follower:${config.port}] Applied seq ${seq}: Logged new operation (${operation})`);

  }

  else {
    console.warn(`[Follower:${config.port}] Unknown operation: ${operation}`);
  }

}

const applyOperation = async (operation, data, seq) => {
  // Check if operation was already applied
  if (seq <= lastAppliedSeq) {
    console.warn(`[Follower:${config.port}] Duplicate detected. Ignoring seq: ${seq}`);
    return;
  }

  // Check if operation wasn't applied, add to queue and sort by sequence number
  if (seq > lastAppliedSeq + 1) {
    console.log(`[Follower:${config.port}] Gap detected. Queuing seq: ${seq}`);
    pendingQueue.push({ operation, data, seq });
    pendingQueue.sort((a, b) => a.seq - b.seq);
    return;
  }

  // Apply current operation
  try {
    console.log(`[Follower:${config.port} Applying seq: ${seq}]`);
    await executeOperation(operation, seq, data);
    lastAppliedSeq = seq;

    // Check if pending queue has next sequences
    while (pendingQueue.length > 0 && pendingQueue[0].seq === lastAppliedSeq + 1) {
      const nextOp = pendingQueue.shift();
      console.log(`[Follower:${config.port}] Applying queued seq: ${nextOp.seq}`);
      await executeOperation(nextOp.operation, nextOp.seq, nextOp.data);
      lastAppliedSeq = nextOp.seq;
    }
  } catch (err) {
    console.error(`[Follower:${config.port}] Error applying seq ${seq}: ${err.message}`);
    throw err;
  }

}

export const handleReplicate = async (req, res) => {
  const { operation, data, seq, timestamp } = req.body;

  console.log(`[Follower:${config.port}] Received replication: '${operation}' at ${timestamp}`);

  try {
    await applyOperation(operation, data, seq);

    res.status(200).json({
      message: 'ACK',
      operation,
      seq,
      port: config.port
    });
  } catch (err) {
    console.error(`[Follower:${config.port}] Replication error for '${operation}': ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

export const syncFromLeader = async (leaderUrl) => {

  // Get the last applied operation log
  const lastAppliedLog = await OperationLog.findOne().sort({ seq: -1 });

  // Get the last applied sequence number (default to 0)
  lastAppliedSeq = lastAppliedLog ? lastAppliedLog.seq : 0;

  // Fetch missed operations from current leader
  const res = await fetch(`${leaderUrl}/sync?from=${lastAppliedSeq}`);

  if(!res.ok) {
    throw new Error(`Sync failed: ${res.status}`);
  }

  const response = await res.json();
  const missedLogs = response.data || [];

  for (const log of missedLogs) {
    // Apply each missed operation
    try {

      console.log(`[Follower:${config.port} Applying seq: ${log.seq}]`);
      await applyOperation(log.operation, log.data, log.seq);
      console.log(`[Follower: ${config.port}] Successfully applied missed operation. Applied seq: ${log.seq}`);

    } catch (err) {
      throw new Error(`Error occured while applying seq ${seq}: ${err}`);
    }
  }

}