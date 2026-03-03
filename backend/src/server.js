import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import userRoutes from './routes/userRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Requests to /user will be directed to the userRoutes.js module
app.use("/user", userRoutes);

// Requests to /transactions will be directed to the transactionRoutes.js module 
app.use("/transactions", transactionRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});