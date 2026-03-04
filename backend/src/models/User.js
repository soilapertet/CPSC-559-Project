import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    libraryId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    borrowedBooks: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Book"
        }
    ]
}, {timestamps: true});

const User = mongoose.model("User", userSchema);
export default User;