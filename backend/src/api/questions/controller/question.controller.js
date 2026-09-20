import { StatusCodes } from "http-status-codes";
import {
  createQuestionWithVectorService,
  getQuestionsService,
  searchQuestionsSemanticService,
  getSingleQuestionService,
} from "../service/question.service.js";
import {
  assessAnswerAgainstQuestionService,
  generateQuestionDraftCoachService,
} from "../service/geminiTextCoach.service.js";

export const createQuestionController = async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const result = await createQuestionWithVectorService({
      title,
      content,
      userId: req.user.id, //authenticated user(author id)
    });
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Question created successfully",
      data: result.question,
    });
  } catch (error) {
    next(error);
  }
};

//we don't have body so we use query to send
//post and patch are the one who have a body
//query is /question?firstName=abel&lastName=john
export const getQuestionsController = async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search,
      mine: req.query.mine,
      userId: req.user.id,
    };

    const result = await getQuestionsService(filters);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Questions fetched successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// *semantic search

export const searchQuestionsSemanticController = async (req, res, next) => {
  try {
    const result = await searchQuestionsSemanticService({
      query: req.query.query,
      k: req.query.k ? Number(req.query.k) : 5,
      threshold: req.query.threshold ? Number(req.query.threshold) : undefined,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Semantic search completed successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

//*===== single question controller,========

export const getSingleQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;

    const result = await getSingleQuestionService({ questionHash });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Question fetched successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

//* ====== get answer-fit =======
//Handles AI relevance assessment of an answer draft against a question.

export const assessAnswerAgainstQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const { answerText } = req.body;

    const { question } = await getSingleQuestionService({ questionHash });
    // or  const { question } = await getSingleQuestionService({ questionHash,includeAnswer:false, });

    const data = await assessAnswerAgainstQuestionService({
      questionTitle: question.title,
      questionContent: question.content,
      answerText,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Answer fit assessed.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// *=======    draft-coach ============

export const generateQuestionDraftCoachController = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const data = await generateQuestionDraftCoachService({
      title,
      content,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Draft suggestions generated.",
      data,
    });
  } catch (error) {
    next(error);
  }
};
