// These HTTP endpoints implement the message-passing layer of the Bully Algorithm.
// Each node exposes these routes so other nodes can send election, bully, and leader messages.

import express from 'express';

import {
    handleElectionMessage,
    handleBullyMessage,
    handleLeaderMessage,
    initiateElection,
    getElectionState,
} from '../replication/bullyElection.js';

import OperationLog from '../models/OperationLog.js';

const router = express.Router();

router.get('/leader-info', async (req, res) => {
    const state = getElectionState();
    
    try {
        // Query the database for the current highest sequence number on this node
        const lastLog = await OperationLog.findOne().sort({ seq: -1 });
        const lastAppliedSeq = lastLog ? lastLog.seq : 0;

        res.json({
            leaderUrl: state.currentLeaderUrl,
            leaderId: state.currentLeaderUrl ? parseInt(new URL(state.currentLeaderUrl).port, 10) : null,
            lastAppliedSeq: lastAppliedSeq // ADD THIS: Crucial for the leader to find the most up-to-date node
        });
    } catch (err) {
        // Fallback if DB query fails
        res.json({
            leaderUrl: state.currentLeaderUrl,
            lastAppliedSeq: 0 
        });
    }
});

// GET leader-info for new nodes
router.get('/leader-info', (req, res) => {
    const state = getElectionState();
    res.json({
        leaderUrl: state.currentLeaderUrl,
        leaderId: state.currentLeaderUrl ? parseInt(new URL(state.currentLeaderUrl).port, 10) : null
    });
});

// Ping: used by the failure detector, "send message to id, wait T time units"
router.get('/ping', (req, res) => {
    res.status(200).json({ alive: true, port: process.env.PORT });
});


// Election Message: Received when a lower-ID process initiates an election
router.post('/election', async (req, res) => {
    const { fromId, fromUrl } = req.body;
    // Respond immediately (don't block on the async handler)
    res.status(200).json({ received: true });
    // Handle asynchronously
    await handleElectionMessage(fromId, fromUrl);
});


// Bully Message: Received by the process that sent the 'election' message.
router.post('/bully', (req, res) => {
    const { fromId } = req.body;
    handleBullyMessage(fromId);
    res.status(200).json({ received: true });
});


// Leader Message: Broadcast by the winner to announce the new leader to all other processes.
router.post('/leader', async (req, res) => {
    const { leaderId, leaderUrl, leaderSeq } = req.body;
    await handleLeaderMessage(leaderId, leaderUrl, leaderSeq);
    res.status(200).json({ received: true });
});


// Manual Election Trigger
router.post('/trigger', async (req, res) => {
    console.log(`[Election] Manual election triggered via HTTP on port ${process.env.PORT}`);
    res.status(200).json({ message: 'Election initiated', port: process.env.PORT });
    await initiateElection();
});


// Status: Returns the current election state for debugging.
router.get('/status', (req, res) => {
    res.status(200).json(getElectionState());
});

export default router;