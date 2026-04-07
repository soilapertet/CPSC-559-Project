// Define environment variables, ports, node roles
import dotenv from 'dotenv';
import path from 'path';

const env = process.env.NODE_ENV;
dotenv.config({ path: path.resolve(`./env/${env}.env`), override: true });

export const config = {
    role: process.env.ROLE,
    port: process.env.PORT,

    nodes: [
        process.env.NODE0_URL,
        process.env.NODE1_URL,
        process.env.NODE2_URL,
        process.env.NODE3_URL,
        process.env.NODE4_URL,
        process.env.NODE5_URL,
    ],
    
    mongo_uri: process.env.MONGODB_URI,
};