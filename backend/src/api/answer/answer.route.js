import express from "express";
import { authenticateUser } from "../../middleware/auth.middleware.js";
import { createAnswerValidation } from "./answer.validation.js";
import {
  createAnswerController,
  getAnswersController,
} from "./answer.controller.js";
/**
 * *1. post /api/answers
 * *2. get /api/answers
 * *3. get /api/answers
 * *4. patch /api/answers/{answerId} update one answer
 * *5. delete /api/answers/{answerId} delete one answer
 */
//
const router = express.Router();

// *=======   post /api/answers ==========

router.post(
  "/",
  authenticateUser,
  createAnswerValidation,
  createAnswerController,
);

// * ==========  get /api/answers ==============
// answer.routes.js

router.get("/", authenticateUser, getAnswersController);
export default router;
