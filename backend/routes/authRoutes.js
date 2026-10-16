import express from "express";
import { getUser, login, register } from "../controllers/authController.js";
import auth from "../middleware/auth.js";

const authRouter = express.Router();

// Register a new user
authRouter.post("/register", register);

// Login user
authRouter.post("/login", login);

// Get authenticated user's details
authRouter.get("/user", auth, getUser);

export default authRouter;
