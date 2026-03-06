import { Schema, model} from "mongoose";

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
    genre : {
        type : String,
        required : true
    },
    year : {
        type : String,
        required : true
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
    }
},
    { timestamps : true }
);

// Add indexing to categories for faster search when querying online library
bookSchema.index({ title : 1 });
bookSchema.index({ author : 1 });
bookSchema.index({ genre : 1 });

bookSchema.index({ 
    title : "text",
    author : "text",
    genre : "text",
    year : "text"
});

const Book = model('Book', bookSchema);
export default Book;