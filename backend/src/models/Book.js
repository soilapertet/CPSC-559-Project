import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Define the schema of a Book instance and specify the required fields
// totalCopies and availableCopies have a min value of 0 to avoid negative values 
// isbn variable will store unique values
// keywords and subjects will store an array of strings
const bookSchema = new Schema({
    title : {
        type : String,
        required : true,
        trim : true
    },
    author : {
        type : String,
        required : true,
        trim : true
    },
    isbn : {
        type : String,
        required : true,
        unique : true,
        trim : true
    },
    totalCopies : {
        type : Number,
        required : true,
        min : 0
    },
    availableCopies : {
        type : Number,
        required : true,
        min : 0
    },
    keywords : {
        type : [String],
        default : []
    },
    subjects : {
        type : [String],
        default : []
    },
    genres : {
        type : [String],
        default : []
    }
},
    { timestamps : true }
);

bookSchema.index({ subjects : 1 });
bookSchema.index({ keywords : 1 });
bookSchema.index({ author : 1 });
bookSchema.index({ genres : 1 });

bookSchema.index({ 
    title : "text",
    author : "text",
    keywords : "text", 
    subjects : "text" 
});

const Book = model('Book', bookSchema);
export default Book;