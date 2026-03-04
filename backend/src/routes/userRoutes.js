// Defines endpoints for user authentication (login/signup).
import express from 'express';

// Import the user controller module into the userRoutes.js file
import * as userController from '../controllers/userController.js';

const router = express.Router();

// Define the routes
router.post('/login', userController.login);
router.post('/createuser', userController.createUser);

export default router;