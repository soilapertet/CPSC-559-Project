import express from 'express';
import { config } from '../config/config.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        status: 'alive',                                    // node's status
        port: config.port,                                  // node's identifier
        role: config.role,                                  // node's role
        timestamp: new Date().toISOString()                 // track heartbeat's send time
    });
});

export default router;