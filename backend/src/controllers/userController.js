// Handles logic for user registration and authentication.
import mongoose from "mongoose";
import User from "../models/User.js";
import OperationLog from "../models/OperationLog.js";
import { propagateToFollowers } from "../replication/leader.js";

// ================== Create User ==================
export const createUser = async (req, res) => {

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstName, lastName, userName, email, request_id } = req.body;

    // Validate input
    if (!firstName || !lastName || !userName || !email || !request_id) {
      await session.abortTransaction();
      return res.status(400).json({
        error: "firstName, lastName, userName, email, and request_id are required"
      });
    }

    const normalizedEmail = email.toLowerCase();

    // Check if a duplicate user creation record already exists
    const existingOp = await OperationLog.findOne({ request_id }).session(session);

    if (existingOp && existingOp.committed) {
      return res.status(200).json({
        message: "User already created"
      });
    }

    // Check for duplicate username
    const existingUserName = await User.findOne({ userName }).session(session);
    if (existingUserName) {
      return res.status(400).json({
        error: "Username already taken"
      });
    }

    // Check for duplicate email
    const existingEmail = await User.findOne({ email: normalizedEmail }).session(session);
    if (existingEmail) {
      return res.status(400).json({
        error: "Email already in use"
      });
    }

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      userName,
      email: normalizedEmail
    });

    await newUser.save({ session });

    try {
      // Propagate to followers (leader only, fire-and-forget)
      await propagateToFollowers(request_id, 'createUser', {
        _id: newUser._id.toString(),
        firstName,
        lastName,
        userName,
        email: normalizedEmail
      });

      await session.commitTransaction();

      res.status(201).json({
        message: "User created successfully",
        userId: newUser._id
      });
    } catch (err) {

      console.error("[Leader] Quorum failed, rolling back changes to database.");
      await session.abortTransaction();

      return res.status(503).json({
        error: "Error occurred while registering. Please try again.",
        request_id
      })
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.endSession();
  }
};

// ================== Login (No Passwords) ==================
export const login = async (req, res) => {
  try {
    const { identifier } = req.body;

    // identifier = username OR email
    if (!identifier) {
      return res.status(400).json({
        error: "Username or email is required"
      });
    }

    // Find user by username OR email
    const user = await User.findOne({
      $or: [
        { userName: identifier },
        { email: identifier.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    res.status(200).json({
      message: "Login successful",
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      email: user.email
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};