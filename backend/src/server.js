import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

import { config } from "./config/config.js";

import userRoutes from './routes/userRoutes.js';
import booksRoutes from './routes/booksRoutes.js';
import followerBooksRoutes from './routes/followerBooksRoutes.js';
import borrowRoutes from './routes/borrowRoutes.js';
import replicateRoutes from './routes/replicateRoutes.js';

// Create a connection to the MongoDB instance
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Requests to /user will be directed to the userRoutes.js module
app.use("/books/user", userRoutes);

// Requests to /browse will be directed to the browseRoutes.js module
app.use("/books", booksRoutes);

app.use("/borrow", borrowRoutes);

app.listen(config.port, () => {
  console.log(`${config.role.toUpperCase()} running on port ${config.port}`);
});

// Read-only borrow history routes — available on all nodes
app.use("/borrow", borrowRoutes);

if (config.role === 'follower') {
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
