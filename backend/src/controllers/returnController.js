// Handles logic for returning transactions.
import Book from "../models/Book.js";
import Transaction from "../models/Transaction.js";
import { propagateToFollowers } from "../replication/leader.js";

export const returnBook = async (req, res) => {
  try {
    const { userId, bookId, request_id } = req.body;

    // Validate input
    if (!userId || !bookId || !request_id) {
      return res.status(400).json({ error: "userId, bookId, and request_id are required" });
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

    try {
      // Propagate to followers first (leader only)
      await propagateToFollowers(request_id, 'return', {
        transactionId: transaction._id.toString(),
        bookId: bookId.toString(),
        returnedAt: new Date()
      });

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
    } catch (err) {

      // No rollback needed since we propagate first, and if fails, we don't apply
      return res.status(503).json({
        error: "Error occurred while returning book. Please try again.",
        request_id
      })
    }

    res.status(200).json({
      message: "Book returned successfully.",
      transaction
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};