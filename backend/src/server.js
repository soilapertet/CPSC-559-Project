import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

import userRoutes from './routes/userRoutes.js';
import booksRoutes from './routes/booksRoutes.js';
import borrowRoutes from './routes/borrowRoutes.js';

dotenv.config();

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

