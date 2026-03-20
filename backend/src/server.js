import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

import userRoutes from './routes/userRoutes.js';
import booksRoutes from './routes/booksRoutes.js';
import followerBooksRoutes from './routes/followerBooksRoutes.js';
import borrowRoutes from './routes/borrowRoutes.js';
import replicateRoutes from './routes/replicateRoutes.js';

dotenv.config();

const role = process.env.NODE_ROLE || 'leader';
const PORT = process.env.PORT || 5000;

// Connect to this node's own MongoDB database
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

console.log(`[${role.toUpperCase()}] Starting on port ${PORT}`);

// Health check — available on all nodes
app.get("/health", (_req, res) => {
  res.json({ status: "ok", role, port: PORT });
});

// Read-only borrow history routes — available on all nodes
app.use("/borrow", borrowRoutes);

if (role === 'follower') {
  // Followers: serve reads only + accept replication from leader
  app.use("/books", followerBooksRoutes);
  app.use("/replicate", replicateRoutes);
} else {
  // Leader: serve all operations (reads + writes)
  app.use("/books/user", userRoutes);
  app.use("/books", booksRoutes);
}

app.listen(PORT, () => {
  console.log(`[${role.toUpperCase()}] Server running on port ${PORT}`);
});
