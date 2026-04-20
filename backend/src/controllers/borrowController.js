// Handles logic for borrowing transactions.
import Book from "../models/Book.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { propagateToFollowers } from "../replication/leader.js";

export const getActiveBorrows = async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await Transaction.find({ userId, status: 'borrowed' })
      .populate('bookId', 'title author')
      .sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBorrowHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await Transaction.find({ userId })
      .populate('bookId', 'title author')
      .sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const borrowBook = async (req, res) => {
  try {
    const { userId, bookId, request_id } = req.body;

    // Validate input
    if (!userId || !bookId || !request_id ) {
      return res.status(400).json({ error: "userId, bookId, and request_id are required" });
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

    try {

      // Propagate to followers (leader only, fire-and-forget)
      await propagateToFollowers(request_id, 'borrow', {
        userId: user._id.toString(),
        bookId: book._id.toString(),
        transactionId: transaction._id.toString(),
        dueDate: transaction.dueDate
      });
    } catch(err) {

      // Rollback in case when quorum is not meant
      console.log("[Leader] Quorum failed, rolling back to changes to database.");

      // Update book inventory since borrow operation failed
      book.availableCopies += 1;
      await book.save();

      // Delete borrow transaction from records
      await Transaction.findByIdAndDelete(transaction._id);

      return res.status(503).json({
        error: "Borrow operation could not be completed. Please try again.",
        request_id
      });
    }
    
    res.status(200).json({
      message: "Book borrowed successfully",
      transaction
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

