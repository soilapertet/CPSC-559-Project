// Defines endpoints for searching, borrowing, and returning books.
import express from 'express';

// Import the controller modules into the transactionRoutes.js file
import * as borrowController from '../controllers/borrowController';
import * as returnController from '../controllers/returnController';
import * as searchController from '../controllers/searchController';

const router = express.Router();

// Define routes
router.post('/borrow', borrowController.borrowBooks);
router.post('/return', returnController.returnBooks);
router.get('/search', searchController.findBooks);
