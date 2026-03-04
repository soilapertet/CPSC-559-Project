import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Define the schema for a Transaction instance
// userId, bookId, status are required fields to keep track of the user, book and their relationship 
// E.g. User X borrowed/returned Book Y
const transactionSchema = new Schema({
    userId : {
        type : Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    bookId : {
        type : Schema.Types.ObjectId,
        ref : "Book",
        required : true
    },
    status : {
        type : String,
        enum : ["borrowed", "returned"],
        required : true
    },
    dueDate : {
        type : Date
    },
    returnedAt : {
        type : Date
    }
},
    { timestamps : true }
);

transactionSchema.index({ userId : 1 });
transactionSchema.index({ bookId : 1 });
transactionSchema.index({ status : 1 });

const Transaction = model("Transaction", transactionSchema);
export default Transaction;