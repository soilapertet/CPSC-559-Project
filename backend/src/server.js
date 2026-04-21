import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

import { config } from "./config/config.js";

import userRoutes from './routes/userRoutes.js';
import booksRoutes from './routes/booksRoutes.js';
import borrowRoutes from './routes/borrowRoutes.js';
import replicateRoutes from './routes/replicateRoutes.js';
import healthRoute from './routes/healthRoute.js';
import eventRoute from './routes/eventRoute.js';
import syncRoutes from './routes/syncRoutes.js';

import electionRoutes from './routes/electionRoutes.js';
import { startInitialElection } from './replication/bullyElection.js';

import { initializeCounter } from "./replication/leader.js";
import { initializeFollowerState } from "./replication/follower.js";

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Requests to /user will be directed to the userRoutes.js module
app.use("/books/user", userRoutes);

// Requests to /browse will be directed to the booksRoutes.js module
app.use("/books", booksRoutes);

// Requests to /borrow will be directed to the borrowRoutes.js module
app.use("/borrow", borrowRoutes);

// Follower nodes will accept replication from leader through /replicate node
app.use("/replicate", replicateRoutes);

// Requests to /sync will direct nodes to syncRoutes.js module
app.use("/sync", syncRoutes);

// Add a health checkpoint for nodes
app.use("/health", healthRoute);

// Add a endpoint to leader election algorithm
app.use("/election", electionRoutes);

// Add an endpoint for frontend to receive real-time updates
app.use("/events", eventRoute);

// Add an endpoint to crash leader during mid-write for demo purposes
app.post('/debug/crash', (req, res) => {
  console.log("[DEBUG] Crashing leader...");
  res.status(200).send('Crashing');

  setTimeout(() => {
    process.exit(1);
  }, 100);
});


async function startServer() {

  // Create a connection to the MongoDB instance
  await connectDB();

  // Initialize follower state
  await initializeFollowerState();

  app.listen(config.port, '0.0.0.0', () => {

    console.log(`${config.role.toUpperCase()} running on port ${config.port}`);

    // Initiate leader election on server setup
    setTimeout(() => {
      startInitialElection();
    }, 3000);

  });

}

startServer();
