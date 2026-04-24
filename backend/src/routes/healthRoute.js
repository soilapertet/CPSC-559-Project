import express from 'express';
import { config } from '../config/config.js';
import OperationLog from '../models/OperationLog.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const latestLog = await OperationLog.findOne().sort({ seq: -1 });
    const latestSeq = latestLog ? latestLog.seq : 0;
    res.json({
        status: 'alive',                                    // node's status
        port: config.port,                                  // node's identifier
        role: config.role,                                  // node's role
        seq: latestSeq,                                     // node's last sequence applied
        timestamp: new Date().toISOString()                 // track heartbeat's send time
    });
});

export default router;