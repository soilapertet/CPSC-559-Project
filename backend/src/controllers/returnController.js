// Handles logic for returning transactions.
import Book from "../models/Book.js";
import Transaction from "../models/Transaction.js";

export const returnBook = async (req, res) => {
  try {
    const { userId, bookId } = req.body;

    // Validate input
    if (!userId || !bookId) {
      return res.status(400).json({ error: "userId and bookId are required" });
    }

    // Find active borrow transaction
    const transaction = await Transaction.findOne({
      userId,
      bookId,
      status: "borrowed"
    });

    if (!transaction) {
      return res.status(404).json({
        error: "No active borrowed record found for this user and book"
      });
    }

    // Update transaction
    transaction.status = "returned";
    transaction.returnedAt = new Date();

    await transaction.save();

    // Increase available copies
    const book = await Book.findById(bookId);

    if (book) {
      book.availableCopies += 1;
      await book.save();
    }

    res.status(200).json({
      message: "Book returned successfully",
      transaction
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};