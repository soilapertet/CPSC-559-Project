// Handles logic for querying the Online Public Access Catalogue (OPAC).

// Import the Book model
import Book from '../models/Book.js';

export const searchBooks = async (req, res) => {

    // Define an empty query dictionary
    const query = {};

    // Extract the filter from the query string, if present 
    // Filters : Keyword | Title | Author | Genre | ISBN
    const { keyword, title, author, genre, isbn } = req.query;

    if(keyword) {
        query.$text = { $search : keyword };
    }

    if(title) {
        query.title = { $regex : title, $options : "i" };
    }

    if(author) {
        query.author = { $regex : author, $options : "i" };
    }

    if(genre) {
        query.genre = { $regex : genre, $options : "i" };
    }

    if(isbn) {
        query.isbn = isbn;
    }

    try {
        const books = await Book.find(query);
        res.json(books);
    } catch(err) {
        res.status(500).json({ error : "An error occured while fetching books"});
    }
}