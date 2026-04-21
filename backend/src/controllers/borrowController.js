// Handles logic for borrowing transactions.
import Book from "../models/Book.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { propagateToFollowers } from "../replication/leader.js";
import OperationLog from "../models/OperationLog.js";

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
    if (!userId || !bookId || !request_id) {
      return res.status(400).json({ error: "userId, bookId, and request_id are required" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }


    let lockedBook = null;
    let transaction = null;

    try {

      // Acquire lock with timeout protection
      const timeout = 5000;

      // a. Match book only if:
      //      it matches the given book id AND
      //      it is not locked OR
      //      the lock expired

      // b. If match is found, acquire lock to prevent future operations on the same book
      lockedBook = await Book.findOneAndUpdate(
        {
          _id: bookId,
          $or: [
            { locked: false },
            { lockTimeStamp: { $lt: new Date(Date.now() - timeout) } }
          ]
        },
        {
          $set: {
            locked: true,
            lockTimeStamp: new Date()
          }
        },
        { returnDocument : "after" }
      );

      // Check if book is currently locked, or in the middle of a borrow transaction 
      // to prevent double booking
      if (!lockedBook) {
        return res.status(409).json({
          error: "Book is currently being processed. Please retry."
        });
      }

      // Check for available copies
      if (lockedBook.availableCopies <= 0) {
        return res.status(400).json({ error: "No copies available" });
      }

      // Decrease available copies
      lockedBook.availableCopies -= 1;
      await lockedBook.save();

      // Create transaction record
      transaction = new Transaction({
        userId: user._id,
        bookId: bookId,
        status: "borrowed",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
      });

      await transaction.save();

      // Propagate to followers (leader only, fire-and-forget)
      await propagateToFollowers(request_id, 'borrow', {
        userId: user._id.toString(),
        bookId: bookId.toString(),
        transactionId: transaction._id.toString(),
        dueDate: transaction.dueDate
      });

      res.status(200).json({
        message: "Book borrowed successfully",
      });

    } catch (err) {

      // Rollback in case when quorum is not meant
      console.log("[Leader] Quorum failed, rolling back to changes to database.");

      if (lockedBook) {
        // Update book inventory since borrow operation failed
        lockedBook.availableCopies += 1;
        await lockedBook.save();
      }

      if (transaction) {
        // Delete borrow transaction from records
        await Transaction.findByIdAndDelete(transaction._id);
      }

      return res.status(503).json({
        error: "Borrow operation could not be completed. Please try again.",
        request_id
      });

    } finally {
      // Release lock after transaction
      if (lockedBook) {
        await Book.findByIdAndUpdate(bookId, {
          $set: { locked: false }
        })
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

