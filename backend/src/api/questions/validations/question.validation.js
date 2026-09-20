import { body, param,query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handeler.js";
import { query } from "express-validator";
// * express-validator :body,param,query
export const createQuestionValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Question title is required")
    .isLength({ min: 5, max: 200 })
    .withMessage("Question title must be between 5 and 200 characters"),

  body("content")
    .trim()
    .notEmpty()
    .withMessage("Question content is required")
    .isLength({ min: 10, max: 5000 })
    .withMessage("Question content must be between 10 and 5000 characters")
    .trim(),
  validationErrorHandler,
];

// *optionally validate query parameters

export const getQuestionsValidation = [
  //search and mine are optional the first is string and mine is boolean
  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim(),

  query("mine").optional().isBoolean().withMessage("Mine must be a boolean"),

  validationErrorHandler,
];

//*semantic search validation

export const searchQuestionsSemanticValidation = [
  query("query")
    .notEmpty()
    .withMessage("query is required")
    .isString()
    .withMessage("query must be a string")
    .isLength({ min: 5 })
    .withMessage("query must be at least 5 characters")
    .trim(),
  // *Top K
  query("k")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("k must be between 1 and 20")
    .toInt(),
  // *THRESHOLD
  query("threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("threshold must be between 0 and 1")
    .toFloat(),

  validationErrorHandler,
];

//*======get single question ======

export const getSingleQuestionValidation = [
  param("questionHash")
    .isString()
    .withMessage("Question hash is required")
    .matches(/^[a-f0-9]{16}$/)
    .withMessage("Question hash must be a 16-character Lowercase hex string"),

  validationErrorHandler,
];

//*========  post answer-fit =======

export const assessAnswerAgainstQuestionValidation = [
  param("questionHash")
    .isString()
    .withMessage("Question hash is required")
    .matches(/^[a-f0-9]{16}$/)
    .withMessage("Question hash must be a 16-character lowercase hex string"),

  body("answerText")
    .notEmpty()
    .withMessage("Answer text is required")
    .isString()
    .withMessage("Answer text must be a string")
    .isLength({ min: 20 })
    .withMessage(
      "Answer text must be at least 20 characters for a meaningful fit check",
    )
    .trim(),

  validationErrorHandler,
];

//*=====  Draft-coach ==========
/** as posting a question -AI coach only reads draft text */
export const generateQuestionDraftCoachValidation = [
  body("title")
    .notEmpty()
    .withMessage("Question title is required")
    .isString()
    .withMessage("Question title must be a string")
    .isLength({ min: 5, max: 255 })
    .withMessage("Question title must be between 5 and 255 characters")
    .trim(),

  body("content")
    .notEmpty()
    .withMessage("Question content is required")
    .isString()
    .withMessage("Question content must be a string")
    .isLength({ min: 10 })
    .withMessage("Question content must be at least 10 characters")
    .trim(),

  validationErrorHandler,
];
