// Handles logic for borrowing transactions.
import Book from "../models/Book.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

export const borrowBook = async (req, res) => {
  try {
    const { userId, bookId } = req.body;

    // Validate input
    if (!userId || !bookId) {
      return res.status(400).json({ error: "userId and bookId are required" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Check for available copies
    if (book.availableCopies <= 0) {
      return res.status(400).json({ error: "No copies available" });
    }

    // Decrease available copies
    book.availableCopies -= 1;
    await book.save();

    // Create transaction record
    const transaction = new Transaction({
      userId: user._id,
      bookId: book._id,
      status: "borrowed",
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
    });

    await transaction.save();

    res.status(200).json({
      message: "Book borrowed successfully",
      transaction
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

