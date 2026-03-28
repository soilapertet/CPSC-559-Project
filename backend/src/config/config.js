// Define environment variables, ports, node roles
import dotenv from 'dotenv';
import path from 'path';

const env = process.env.NODE_ENV;
dotenv.config({ path: path.resolve(`./env/${env}.env`), override: true });

export const config = {
    role: process.env.ROLE,
    port: process.env.PORT,

    followers: [
        process.env.LEADER_URL,
        process.env.FOLLOWER1_URL,
        process.env.FOLLOWER2_URL,
        process.env.FOLLOWER3_URL,
        process.env.FOLLOWER4_URL,
    ],
    
    mongo_uri: process.env.MONGODB_URI,

    // Get the current leader from the terminal after leader election algorithm
    get leaderUrl() {
        return process.env.LEADER_URL;
    },
};