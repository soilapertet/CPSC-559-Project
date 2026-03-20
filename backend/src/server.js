import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

import { config } from "./config/config.js";

import userRoutes from './routes/userRoutes.js';
import booksRoutes from './routes/booksRoutes.js';
import borrowRoutes from './routes/borrowRoutes.js';

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

