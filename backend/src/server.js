import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

import { config } from "./config/config.js";

import userRoutes from './routes/userRoutes.js';
import booksRoutes from './routes/booksRoutes.js';
import borrowRoutes from './routes/borrowRoutes.js';
import replicateRoutes from './routes/replicateRoutes.js';
import healthRoute from './routes/healthRoute.js';

import { startLeaderHeartbeat } from "./replication/leader.js";
import { startFollowerHeartbeat } from "./replication/follower.js";

import electionRoutes from './routes/electionRoutes.js';
import { startInitialElection } from './replication/bullyElection.js';

const HEARTBEAT_DELAY = 5000;

// Create a connection to the MongoDB instance
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Requests to /user will be directed to the userRoutes.js module
app.use("/books/user", userRoutes);

// Requests to /browse will be directed to the browseRoutes.js module
app.use("/books", booksRoutes);

// Requests to /borrow will be directed to the borrowRoutes.js module
app.use("/borrow", borrowRoutes);

// Follower nodes will accept replication from leader  through /replicate node
app.use("/replicate", replicateRoutes);

// Add a health checkpoint for nodes
app.use("/health", healthRoute);

// Add a endpoint to leader election algorithm
app.use("/election", electionRoutes);

app.listen(config.port, () => {

  console.log(`${config.role.toUpperCase()} running on port ${config.port}`);

  // Heartbeat logic
  if (config.role == 'leader') {

    // Wait 5 seconds before sending heartbeat to account for manual setup
    setTimeout(() => {
      console.log(`[Leader ${config.port}] Starting heartbeat monitoring...`)
      startLeaderHeartbeat();
    }, HEARTBEAT_DELAY);
  } else {
    setTimeout(() => {
      console.log(`[Node ${config.port}] Starting heartbeat monitoring...`)
      startFollowerHeartbeat();
    }, HEARTBEAT_DELAY);
  }
  
  setTimeout(() => {
      startInitialElection();
    }, 2000);
});

