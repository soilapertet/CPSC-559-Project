import { Schema, model } from "mongoose";

// Define the schema of a User instance and specify the required fields
// userName and email variables will store to unique values
const userSchema = new Schema({
    firstName : {
        type : String,
        required : true,
        trim : true
    },
    lastName : { 
        type : String,
        required : true,
        trim : true
    },
    userName : {
        type : String,
        required : true,
        unique : true,
        trim : true
    },
    email : {
        type : String, 
        required : true,
        unique : true,
        trim : true,
        lowercase : true
    }
},
    { timestamps : true }
);

const User = model('User', userSchema);
export default User;