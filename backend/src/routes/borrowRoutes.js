import express from 'express';
import { getActiveBorrows, getBorrowHistory } from '../controllers/borrowController.js';

const router = express.Router();

router.get('/active/:userId', getActiveBorrows);
router.get('/history/:userId', getBorrowHistory);

export default router;
