// Defines endpoints for user authentication (login/signup).
import express from 'express';

// Import the user controller module into the userRoutes.js file
import * as userController from '../controllers/userController.js';

import { isLeader } from '../middleware/roleGuard.js';

const router = express.Router();

// Define the routes
// No guard because read operation can be done by any node
router.post('/login', userController.login);

// Add a guard between route and route handler to ensure user creation is only done by leader node
router.post('/createuser', isLeader, userController.createUser);

export default router;