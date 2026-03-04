import mongoose from "mongoose";

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    isbn: {
        type: String,
        required: true,
        unique: true
    },
    genre: {
        type: String,
        required: true
    },
    year: {
        type: String,
        required: true
    },
    totalCopies: {
        type: Number,
        required: true,
        min: 0
    },
    availableCopies: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String
    }
}, {timestamps: true});

const Book = mongoose.model("Book", bookSchema);
export default Book;