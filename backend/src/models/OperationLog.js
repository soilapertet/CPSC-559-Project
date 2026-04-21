import { Schema, model } from "mongoose";

// Define a new schema to store an operation log insance
const operationLogSchema = new Schema({
    seq : {
        type : Number,
        required : true,
        unique : true,
    },
    request_id : {
        type : String,
        required: true,
        unique : true,
    }, 
    operation : {
        type : String,
        required : true,
        enum : ["borrow", "return", "createUser"]
    },
    data : {
        type : Schema.Types.Mixed,
        required : true
    },
    committed : {
        type : Boolean,
        default : false
    },
    timestamp : {
        type : Date,
        default : Date.now
    }
});

// Register the OperationLog model in Mongoose
// Define OperationLog model -> Links to operationLogSchema -> Pushes documentions to operation_logs collection
const OperationLog = model('OperationLog', operationLogSchema, 'operation_logs');
export default OperationLog;