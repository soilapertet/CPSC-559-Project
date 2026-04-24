import { Schema, model} from "mongoose";

const counterSchema = new Schema({
    _id : { 
        type: String,
        required : true
    },
    value : {
        type: Number,
        default : 0
    }
});

const Counter = model('Counter', counterSchema);
export default Counter;