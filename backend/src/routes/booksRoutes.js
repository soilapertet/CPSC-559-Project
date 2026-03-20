// Handle general operations such as displaying all books, filtering by category, getting book 
// details etc.
import express from 'express';
import { isLeader } from '../middleware/roleGuard.js';

import * as booksController from '../controllers/booksController.js';
import * as borrowController from '../controllers/borrowController.js';
import * as returnController from '../controllers/returnController.js';
import * as searchController from '../controllers/searchController.js';

const router = express.Router();

// State-changing operations (Write Operations)
// Add a guard between route and route handler to ensure only write operations are directed to the leader
router.post('/borrow', isLeader, borrowController.borrowBook);
router.post('/return', isLeader, returnController.returnBook);

// Read-only operations
// No guard since any node can handle read operations
router.get('/search', searchController.searchBooks);

// Get a book based on the provided book id
router.get("/:id", booksController.getBookById);

// Get all books or filter books in the online library
router.get("/", booksController.getBooks);

export default router;