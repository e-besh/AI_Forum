import { body, param, query } from "express-validator";
import { validationErrorHandler } from "../../middleware/validation-handeler.js";

// * =========   post answer ==========
export const createAnswerValidation = [
  body("questionId")
    .notEmpty()
    .withMessage("Question id is required")
    .isInt({ min: 1 })
    .withMessage("Question id must be a positive integer")
    .toInt(),

  body("content")
    .notEmpty()
    .withMessage("Answer content is required")
    .isString()
    .withMessage("Answer content must be a string")
    .isLength({ min: 20 })
    .withMessage("Answer content must be at least 20 characters")
    .trim(),

  validationErrorHandler,
];
