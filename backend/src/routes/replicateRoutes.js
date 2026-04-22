import express from 'express';
import { handleReplicate } from '../replication/follower.js';

const router = express.Router();

// Receives replication payloads from the leader node
router.post('/', handleReplicate);

export default router;
