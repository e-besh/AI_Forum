import { StatusCodes } from "http-status-codes";
import { createAnswerService, getAnswersService } from "./answer.service.js";

// *======= create question ==========
export const createAnswerController = async (req, res, next) => {
  try {
    const { questionId, content } = req.body;

    const answer = await createAnswerService({
      questionId,
      content,
      userId: req.user.id,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Answer posted successfully.",
      data: answer,
    });
  } catch (error) {
    next(error);
  }
};

// *================get answer ============

export const getAnswersController = async (req, res, next) => {
  try {
    const answers = await getAnswersService();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Answers fetched successfully.",
      data: answers,
    });
  } catch (error) {
    next(error);
  }
};
