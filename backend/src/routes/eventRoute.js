import express from 'express';
import { config } from '../config/config.js';
import { getFollowerStatus } from '../replication/leader.js';

const router = express.Router();

// Store all connected frontend clients
const clients = new Set();

router.get('/', (req, res) => {

    // Establish a connection stream to send real-time updates in the backend (new leader, dead leader, dead follower) 
    // to the frontend
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get active followers
    const followers = getFollowerStatus();
    const aliveUrls = [];
    followers.forEach((status, url) => {
        const isSelf = new URL(url).port === String(config.port);
        if (status.alive && !isSelf) aliveUrls.push(url);
    });

    // Send active followers to frontend
    if (aliveUrls.length > 0) {
        const initialState = {
            type: 'follower-state',
            urls: aliveUrls
        };
        res.write(`event: follower-state\ndata: ${JSON.stringify(initialState)}\n\n`);
    }

    // Add current client to set
    clients.add(res);
    console.log(`[Node ${config.port}] Frontend connected to event stream.`);

    // Remove client once connection is disconnected
    req.on('close', () => {
        clients.delete(res);
        console.log(`[Node ${config.port}] Frontend disconnected from event stream.`);

    });
});

// Call function in backend to notify all connected frontends of any changes
export function notifyFrontend(data) {
    // named event (what frontend expects)
    // event: follower-dead
    // data: {"type":"follower-dead","url":"..."}\n\n
    const message = `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`
    clients.forEach(client => client.write(message))
};

export default router;