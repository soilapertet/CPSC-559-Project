// Handles logic for user registration and authentication.
import User from "../models/User.js";

// ================== Create User ==================
export const createUser = async (req, res) => {
  try {
    const { firstName, lastName, userName, email } = req.body;

    // Validate input
    if (!firstName || !lastName || !userName || !email) {
      return res.status(400).json({
        error: "firstName, lastName, userName, and email are required"
      });
    }

    // Check for duplicate username
    const existingUserName = await User.findOne({ userName });
    if (existingUserName) {
      return res.status(400).json({
        error: "Username already taken"
      });
    }

    // Check for duplicate email
    const existingEmail = await User.findOne({ email });
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
      email
    });

    await newUser.save();

    res.status(201).json({
      message: "User created successfully",
      userId: newUser._id
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
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