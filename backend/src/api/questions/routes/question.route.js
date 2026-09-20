import express from "express";
import { authenticateUser } from "../../../middleware/auth.middleware.js";
import {
  createQuestionValidation,
  getQuestionsValidation,
  searchQuestionsSemanticValidation,
  getSingleQuestionValidation,
  assessAnswerAgainstQuestionValidation,
  generateQuestionDraftCoachValidation,
} from "../validations/question.validation.js";
import {
  createQuestionController,
  getQuestionsController,
  searchQuestionsSemanticController,
  getSingleQuestionController,
  assessAnswerAgainstQuestionController,
  generateQuestionDraftCoachController,
} from "../controller/question.controller.js";

const router = express.Router();
/**
 * @route 1.POST /api/questions
 * @route 2.GET /api/questions
 * @route 3.GET /api/questions/search //semantic search using vector embeddings ai engine(question_vector)
 *  @route 6.POST /api/questions/draft-coach // all draft coach for new questions ai help
 *  @route 5.POST /api/questions/{questionHash}/answer-fit //all answers draft fit vs question
//  * OUR TOPIC Part
 * @route 4.GET /api/questions/{questionHash} //single question with answers
 * @route 7.GET /api/questions/{questionHash}/similar
 */
//*if someone post question that we need is title and content and userId
//*who:authenticateUser middleware
//*what:createQuestionValidation middleware:not empty title and content
// *then:createQuestionController controller:extract title and body and userId from request and create question in database
router.post(
  "/",
  authenticateUser,
  createQuestionValidation,
  createQuestionController,
);
//*==========GET /api/questions:search filtering:exact keyword=======

router.get(
  "/",
  authenticateUser,
  getQuestionsValidation,
  getQuestionsController,
);
//semantic search for questions using vector embedding based on text query
//similarity(cosine similarity) or threshold=0.75 and value 5(max no of result to return)
//*========= GET /api/questions/search :semantic(AI) search =====

router.get(
  "/search",
  authenticateUser,
  searchQuestionsSemanticValidation,
  searchQuestionsSemanticController,
);
//*======  GET /api/questions/{questionHash} :single question with answers

router.get(
  "/:questionHash",
  authenticateUser,
  getSingleQuestionValidation,
  getSingleQuestionController,
);

//*===== POST /api/questions/{questionHash}/answer-fit ==
//AI check for an answer draft vs the question

router.post(
  ":questionHash/answer-fit",
  authenticateUser,
  assessAnswerAgainstQuestionValidation,
  assessAnswerAgainstQuestionController,
);

//*========   POST /api/questions/draft-coach =======
//AI-coach

router.post(
  "/draft-coach",
  authenticateUser,
  generateQuestionDraftCoachValidation,
  generateQuestionDraftCoachController,
);

//*======   .GET /api/questions/{questionHash}/similar ====
router.post("/:questionHash/similar", authenticateUser);
export default router;
