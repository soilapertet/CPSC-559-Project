import express from 'express';
import { config } from '../config/config.js';
import OperationLog from '../models/OperationLog.js';
import { syncFromLeader } from '../replication/follower.js';
import { getLeaderUrl } from '../replication/bullyElection.js';

const router = express.Router();

// (FOLLOWER NODE) Trigger sycning process to recover missed operations 
router.post('/sync-request', async (req, res) => {

    try {
        let leaderUrl = req.body.leaderUrl || getLeaderUrl();
        let retries = 5;

        // Poll more aggressively during recovery
        while (!leaderUrl && retries > 0) {
            await new Promise(r => setTimeout(r, 500));
            leaderUrl = getLeaderUrl();
            retries--;
        }

        if (!leaderUrl) {
            return res.status(400).json({ error: 'No leader available for sync.' });
        }

        console.log(`[DEBUG] Leader URL: ${leaderUrl}`);

        if (!leaderUrl) {
            return res.status(400).json({
                error: 'No leader available for sync.'
            })
        }

        console.log(`[Syncing Node ${config.port}] Syncing with current leader ${leaderUrl}.`)
        await syncFromLeader(leaderUrl);
        console.log(`[Synced Node ${config.port}] Successfully synced with current leader ${leaderUrl}.`);

        res.status(200).json({
            message: 'Sync complete.'
        });

    } catch (err) {
        res.status(500).json({
            message: 'Error occured while syncing with current leader',
            error: err.message
        });
    }
});

// (LEADER) Retrieves missed write operations from OperationLog collections of the current leader node
router.get('/', async (req, res) => {

    try {

        console.log("[DEBUG] RETRIEVING MISSED LOGS.");

        // Extract the sequence number from which we are recovering write operations
        const fromSeq = parseInt(req.query.from || 0);

        // Check if sequence number is valid
        if (isNaN(fromSeq)) {
            return res.status(400).json({ error: 'Invalid sequence number' });
        }

        // Get all the operation logs such that seq > fromSeq (all missed write operations)
        const missedLogs = await OperationLog.find({
            seq: { $gte: fromSeq },
            committed: true
        }).sort({ seq: 1 });

        console.log(`[DEBUG] NUMBER OF MISSED LOGS: ${missedLogs.length}`);

        res.status(200).json(
            {
                data: missedLogs
            }
        )
    } catch (err) {
        res.status(500).json(
            {
                message: "Error occured while fetching missed write operations",
                error: err.message
            },
        )
    }

});

export default router;