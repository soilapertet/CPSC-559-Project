// Handles logic for browsing all books within database

// Import the Book model
import Book from '../models/Book.js';

// Define a function to fetch a book by its id
export const getBookById = async(req, res) => {

    // Extract the book id from the HTTP request
    const bookId = req.params.id;

    try {
        const book = await Book.findById(bookId);

        // Return an error if the book is not found using the provided book id
        if(!book) {
            return res.status(404).json({ error : "Book not found."});
        }

        // Else, return book result
        res.json(book);
    } catch(err) {
        res.status(500).json({ error : "An error occurred while fetching book."})
    }
}

// Define a function to return all the books within the online library
export const getBooks = async(req, res) => {

    // Define the query body to query the MongoDB database
    let query = {};

    // Extract genre(s) from the query string, if present
    const { genre } = req.query;

    if(genre) {
        query.genres = { $in : [genre] };
    } 

    try {
        
        // if query is empty, return all books
        // else, return books of the specified genre
        const books = await Book.find(query);
        res.json(books)
    } catch (err) {
        res.status(500).json({ error : "An error occurred while fetching the books."})
    }
}
