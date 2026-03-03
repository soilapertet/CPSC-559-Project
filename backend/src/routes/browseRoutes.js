// Handle general operations such as displaying all books, filtering by category, getting book 
// details etc.
import express from 'express';

import * as browseController from '../controllers/browseController.js';

const router = express.Router();

// Get books based on the provided filter
router.get("/filter", browseController.getBooksByFilter);

// Get a book based on the provided book id
router.get("/id/:id", browseController.getBookById);

// Get all books in the online library
router.get("/", browseController.fetchAllBooks);

export default router;