// Logic to block writes to Follower nodes
import { config } from "../config/config.js";

export const isLeader = (req, res, next) => {
    
    // Checks if the write operation is being directed to the leader node
    if(config.role != 'leader') {
        return res.status(403).json({ error: 'Could not process transaction.'})
    }

    next()
}