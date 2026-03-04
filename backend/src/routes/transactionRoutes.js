// Defines endpoints for searching, borrowing, and returning books.
import express from 'express';

// Import the transaction controller modules into the transactionRoutes.js file
import * as borrowController from '../controllers/borrowController.js';
import * as returnController from '../controllers/returnController.js';
import * as searchController from '../controllers/searchController.js';

const router = express.Router();

// Define routes

// State-changing operations (Write Operations)
router.post('/borrow', borrowController.borrowBooks);
router.post('/return', returnController.returnBooks);

// Read-only operations
router.get('/search', searchController.searchBooks);

export default router;