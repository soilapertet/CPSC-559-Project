// Read-only book routes for follower nodes.
// Write operations (borrow, return) are not registered on followers —
// the frontend routes those directly to the leader.
import express from 'express';

import * as booksController from '../controllers/booksController.js';
import * as searchController from '../controllers/searchController.js';

const router = express.Router();

// Read-only operations
router.get('/search', searchController.searchBooks);
router.get('/:id', booksController.getBookById);
router.get('/', booksController.getBooks);

export default router;
