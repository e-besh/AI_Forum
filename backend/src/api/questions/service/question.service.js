import crypto from "crypto";

import { safeExecute } from "../../../../db/config.js";
import { BadRequestError } from "../../../utils/errors/index.js";
import {
  normalizeQuestionTitle,
  storeQuestionVector,
  findSimilarQuestionsByText,
  getVectorConfig,
} from "./vector.service.js";

//*build in node module crypto to generate random hash for question:string 8
const generateQuestionHash = () => crypto.randomBytes(8).toString("hex");
/**
 * create a new question ans store its vector embedding for semantic search
 * @param {object} payload - The question data
 * @param {string} payload.userId - The ID of the user creating the question
 * @param {string} payload.title - The title of the question
 * @param {string} payload.content - The content of the question
 * @returns {Promise<object>} -object containing created question with vector embedding
 */
// *  =================== create question =============
export const createQuestionWithVectorService = async (payload) => {
  const { userId, title, content } = payload;

  //*prepare the sql statement for inserting a new question
  //*hash for url parameter and unique identification
  const insertQuestionSql =
    "INSERT INTO questions (question_hash, user_id, title, content) VALUES (?, ?, ?, ?)";
  // *generate a unique hash for the question
  const questionHash = generateQuestionHash();
  let questionResult;
  try {
    // execute the insertion query safely
    questionResult = await safeExecute(insertQuestionSql, [
      questionHash,
      userId,
      title,
      content,
    ]);
  } catch (error) {
    //handle specific foreign key constraint error for non-existent user
    if (error?.code === "ER_NO_REFERENCED_ROW_2") {
      throw new BadRequestError("User does not exist. Cannot create question.");
    }
    //re-trow any other unexpected errors
    throw error;
  }
  //retrieve the auto-generated ID of the newly inserted question
  const questionId = questionResult.insertId;
  //construct the result object representing the newly created question
  const creationResult = {
    id: questionId,
    questionHash,
    userId,
    title,
    content,
  };
  //prepares the question text before sending it to the embedding model(normalized)
  const sourceText = normalizeQuestionTitle({
    title: payload.title,
  });
  try {
    //generate vector embedding for normalized question text
    const embeddingResult = await generateQuestionHashEmbedding(sourceText, {
      questionId: creationResult.id,
    }); //we got embedding
    //store the generated vector embedding in database with a ready status
    await storeQuestionVector({
      questionId: creationResult.id,
      sourceText,
      embedding: embeddingResult.embedding,
      status: "READY",
    });
  } catch (error) {
    console.log("error", error);
    console.log("error.message", error.message);
    //explicitly record the failure state in database so it can be retried or investigated later(fail insert)
    await storeQuestionVector({
      questionId: creationResult.id,
      sourceText,
      embedding: [],
      status: "FAILED",
    }).catch((e) => {
      console.error("Failed to store failed embedding status:", e.message);
    });
  }
  // return the created question object
  return {
    question: creationResult,
  };
};

// *=================== get filtering=======================

const buildQuestionFilters = (filters) => {
  const conditions = [];
  const params = [];

  if (filters.search) {
    conditions.push("(q.title LIKE ? OR q.content LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (filters.mine && filters.userId) {
    conditions.push("q.user_id = ?");
    params.push(filters.userId);
  }

  if (conditions.length === 0) {
    return { whereClause: "", params };
  }

  return {
    whereClause: WHERE`${conditions.join(" AND ")}`,
    params,
  };
};

export const getQuestionsService = async (filters) => {
  const normalizedLimit = 100; // Fixed max 100 records
  const sortColumn = "q.created_at";
  const normalizedSortOrder = "DESC";

  const { whereClause, params } = buildQuestionFilters(filters);

  const listSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u ON u.user_id = q.user_id
    LEFT JOIN answers a ON a.question_id = q.question_id
    ${whereClause}
    GROUP BY q.question_id, u.user_id
    ORDER BY ${sortColumn} ${normalizedSortOrder}
    LIMIT ${normalizedLimit}
  `;

  const rows = await safeExecute(listSql, params);

  return {
    data: rows.map((question) => ({
      id: question.id,
      questionHash: question.questionHash,
      title: question.title,
      content: question.content,
      answerCount: question.answerCount,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      author: {
        id: question.userId,
        firstName: question.firstName,
        lastName: question.lastName,
      },
    })),
    meta: {
      limit: normalizedLimit,
      total: rows.length,
      sortBy: "newest",
      sortOrder: normalizedSortOrder,
    },
  };
};

//*=========sematic search=========
//query normalized: question embed,database all vector select and map semantic search(score) finally select the value grater than threshold.
//sourceText only normalized not embed at this time

export const searchQuestionsSemanticService = async ({
  query,
  k = 5,
  threshold,
}) => {
  const sourceText = normalizeQuestionText({ title: query });
  const vectorConfig = getVectorConfig();
  const searchThreshold =
    threshold !== undefined ? threshold : vectorConfig.searchThreshold;

  const result = await findSimilarQuestionsByText({
    //at the back sourceText embed, all database score by cosine algorithm
    sourceText,
    threshold: searchThreshold,
    k,
  });

  return {
    data: result.similarQuestions,
    meta: {
      query,
      k,
      threshold: searchThreshold,
      total: result.similarQuestions.length,
    },
  };
};

//*==========single question s==========
// max no of question= 100

export const getSingleQuestionService = async ({ questionHash }) => {
  const normalizedAnswerLimit = 100; // Fixed max 100 records

  const questionSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u ON u.user_id = q.user_id
    LEFT JOIN answers a ON a.question_id = q.question_id
    WHERE q.question_hash = ?
    GROUP BY q.question_id, u.user_id
  `;

  const questionRows = await safeExecute(questionSql, [questionHash]);

  if (questionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }

  const question = questionRows[0];
  const questionId = question.id;

  const answersSql = `
    SELECT
      a.answer_id AS id,
      a.content,
      a.created_at AS createdAt,
      a.updated_at AS updatedAt,
      au.user_id AS userId,
      au.first_name AS firstName,
      au.last_name AS lastName
    FROM answers a
    JOIN users au ON au.user_id = a.user_id
    WHERE a.question_id = ?
    ORDER BY a.created_at DESC
    LIMIT ${normalizedAnswerLimit}
  `;

  const answers = await safeExecute(answersSql, [questionId]);

  return {
    question: {
      id: question.id,
      questionHash: question.questionHash,
      title: question.title,
      content: question.content,
      answerCount: question.answerCount,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      author: {
        id: question.userId,
        firstName: question.firstName,
        lastName: question.lastName,
      },
    },
    answers: answers.map((answer) => ({
      id: answer.id,
      content: answer.content,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
      author: {
        id: answer.userId,
        firstName: answer.firstName,
        lastName: answer.lastName,
      },
    })),
    answersMeta: {
      limit: normalizedAnswerLimit,
      total: answers.length,
    },
  };
};
