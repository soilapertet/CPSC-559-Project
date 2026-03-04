// Handle general operations such as displaying all books, filtering by category, getting book 
// details etc.
import express from 'express';

import * as booksController from '../controllers/booksController.js';

const router = express.Router();

// Get a book based on the provided book id
router.get("/:id", booksController.getBookById);

// Get all books or filter books in the online library
router.get("/", booksController.getBooks);

export default router;