import express from 'express';
import { handleReplicate, handleCommit } from '../replication/follower.js';

const router = express.Router();

// Receives replication payloads from the leader node
router.post('/', handleReplicate);
router.post('/commit', handleCommit);

export default router;
