import express from "express";
import authRoutes from "./auth/routes/auth.routes.js";
import questionRoutes from "./questions/routes/question.route.js";
import answerRoutes from "./answer/answer.route.js";
const mainRouter = express.Router();

// Authentication routes
mainRouter.use("/auth", authRoutes);
export default mainRouter;

// Create question /api/questions
mainRouter.use("/questions", questionRoutes);

// answer /api/answer
mainRouter.use("/answers", answerRoutes);
