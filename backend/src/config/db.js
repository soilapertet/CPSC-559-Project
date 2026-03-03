import mongoose from "mongoose";
import dotenv from "dotenv";

// Load .env file to access environment variables
dotenv.config();  

// Define a function to connect to the MongoDB Database
const connectDB = async () => {

    const uri = process.env.MONGODB_URI || "";

    try {
        const conn = await mongoose.connect(uri);
        console.log(`Connected to MongoDB: ${conn.connection.host}`);
    } catch (err) {
        console.error(`Database connection failed: ${err.message}`);
        process.exit(1);
    }

}

export default connectDB;