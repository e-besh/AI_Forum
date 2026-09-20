import { GoogleGenAI } from "@google/genai";
import { safeExecute } from "../../../../db/config.js";
import { json } from "express";
// Initialize the Google Gen AI client
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";
if (!GEMINI_API_KEY) {
  console.warn("Warning: GEMINI_API_KEY is not set in environment variables.");
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

export function normalizeWhitespace(str) {
  return str.replace(/\s+/g, " ").trim();
}

//*remove spaces,to lowercase
//NFKC: means Normalization Form KC, which is a Unicode normalization form that combines characters and diacritics into a single character, and also applies compatibility decomposition to certain characters. This can be useful for text processing and comparison, as it ensures that visually similar characters are treated as equivalent.
export function normalizeQuestionTitle({ title }) {
  return normalizeWhitespace(`${title}|| ''.normalize('NFKC').toLowerCase()}`);
}

export const normalizeQuestionText = ({ title, content = "" }) => {
  return `${title}\n\n${content}`.trim().replace(/\s+/g, " ");
};

// *============cosineSimilarity=========
//*=====  cos(0)=(A -B)/ (||A|| *||B||)) =========

export function calculateCosineSimilarity(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length) {
    throw new error(
      `vector must have the same length. Got ${vectorA.length} and ${vectorB.length} `,
    );
  }

  //calculate dot product

  let dotProduct = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
  }
  let magnitudeA = 0;
  for (let i = 0; i < vectorA.length; i++) {
    magnitudeA += vectorA[i] * vectorA[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);

  let magnitudeB = 0;
  for (let i = 0; i < vectorB.length; i++) {
    magnitudeB += vectorB[i] * vectorB[i];
  }
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function generateQuestionEmbedding(sourceText, options = {}) {
  const { taskType = "RETRIEVAL_DOCUMENT" } = options;
  //if it is model we use embedding
  try {
    const response = await ai.models.embedContent({
      content: sourceText,
      model: GEMINI_EMBEDDING_MODEL,
      config: {
        taskType: taskType,
        outputDimensionality: 768,
      },
    });
    let values = response?.embedding[0]?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("Gemini API response does not contain a valid ");
    }
    return {
      embedding: values,
    };
  } catch (error) {
    console.error("Error generating embedding:", error.message);
    throw new Error("Failed to generate embedding for the question.");
  }
}
//if embedding is not empty validate

function validateEmbedding(embedding) {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array");
  }
  if (embedding.length === 0) {
    throw new Error("Embedding array cannot be empty");
  }
  if (!embedding.every((v) => typeof v === "number" && !isNaN(v))) {
    throw new Error("Embedding array must contain only valid numbers");
  }
}

export async function storeQuestionVector({
  questionId,
  sourceText,
  embedding = [],
  status = "READY",
}) {
  //failed or no embedding(empty) then insert this
  if (status === "failed" || !embedding || embedding.length === 0) {
    const sql = `
      INSERT INTO question_vector (question_id,source_text,embedding,status)
      values(?,?,?,?)
      ON DUPLICATE KEY UPDATE
      source_text=VALUES(source_text),
      embedding=VALUES(embedding),
      status=VALUES(status),
      updated_at=CURRENT_TIMESTAMP`;

    await safeExecute(sql, [
      questionId,
      sourceText,
      JSON.stringify([]),
      "failed",
    ]);
    return;
  }

  //   validate embedding before storage
  validateEmbedding(embedding);
  //store embedding as JSON string using JSON.stringify()
  const embeddingJson = json.stringify(embedding);

  const sql = `
  INSERT INTO question_vector (question_id,source_text,embedding,status)
      values(?,?,?,?)
      ON DUPLICATE KEY UPDATE
      source_text=VALUES(source_text),
      embedding=VALUES(embedding),
      status=VALUES(status),
      updated_at=CURRENT_TIMESTAMP`;
  try {
    await safeExecute(sql, [questionId, sourceText, embeddingJson, status]);
  } catch (error) {
    console.log("error", error);
    throw error;
  }
}

//*=======semantic search===========

export async function findSimilarQuestionsByText(sourceText, threshold, k) {
  // Normalize parameters
  const normalizedK = k || RECOMMEND_K;
  const normalizedThreshold = threshold || RECOMMEND_THRESHOLD;

  // Use RETRIEVAL_QUERY task type when searching against stored documents
  let embeddingResult;

  try {
    embeddingResult = await generateQuestionEmbedding(sourceText, {
      taskType: "RETRIEVAL_QUERY",
    });
  } catch (error) {
    console.error("=== GEMINI API ERROR DURING SEARCH ===");
    console.error("Operation: findSimilarQuestionsByText");
    console.error("Search text:", sourceText);
    console.error("Error:", error);
    console.error("=======================================");

    throw new ServiceUnavailableError(
      "Failed to generate embedding for search query. Please try again later.",
    );
  }

  const queryEmbedding = embeddingResult.embeddingValues;

  // Retrieve all ready embeddings from MySQL
  let storedEmbeddings;

  try {
    storedEmbeddings = await retrieveReadyEmbeddings();
  } catch (error) {
    console.error("=== DATABASE ERROR DURING SEARCH ===");
    console.error("Operation: findSimilarQuestionsByText");
    console.error("Search text:", sourceText);
    console.error("Error:", error);
    console.error("====================================");

    throw error;
  }

  // Calculate cosine similarity for each stored embedding
  const similarities = [];

  for (const stored of storedEmbeddings) {
    try {
      const score = calculateCosineSimilarity(queryEmbedding, stored.embedding);

      // Filter by threshold
      if (score >= normalizedThreshold) {
        similarities.push({
          questionId: stored.questionId,
          score: score,
        });
      }
    } catch (error) {
      console.warn(
        ` Failed to calculate similarity for question ${stored.questionId}:`,
        error.message,
      );
      continue;
    }
  }

  // Sort by score descending
  similarities.sort((a, b) => b.score - a.score);

  // Limit to top k results
  const topResults = similarities.slice(0, normalizedK);

  if (topResults.length === 0) {
    return {
      ...embeddingResult,
      similarQuestions: [],
    };
  }
  // Fetch question details using IN clause
  const questionIds = topResults.map((r) => r.questionId);
  const placeholders = questionIds.map(() => "?").join(",");

  const sql = `
  SELECT
    q.question_id AS questionId,
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
  WHERE q.question_id IN (${placeholders})
  GROUP BY q.question_id, u.user_id
`;

  let rows;

  try {
    rows = await safeExecute(sql, questionIds);
  } catch (error) {
    console.error("=== DATABASE ERROR FETCHING QUESTION DETAILS ===");
    console.error("Operation: findSimilarQuestionsByText - fetch details");
    console.error("Question IDs:", questionIds);
    console.error("Error:", error);
    console.error("===============================================");
    throw error;
  }

  // Map MySQL results to question objects
  const questionMap = {};

  rows.forEach((row) => {
    questionMap[String(row.questionId)] = {
      id: row.questionId,
      questionHash: row.questionHash,
      title: row.title,
      content: row.content,
      answerCount: row.answerCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: {
        id: row.userId,
        firstName: row.firstName,
        lastName: row.lastName,
      },
    };
  });

  // Return results with scores, preserving sort order
  const similarQuestions = topResults
    .filter((result) => questionMap[String(result.questionId)])
    .map((result) => ({
      score: Number(result.score.toFixed(6)),
      ...questionMap[String(result.questionId)],
    }));

  return {
    ...embeddingResult,
    similarQuestions,
  };
}

/**
 * *Get the current vector search configuration values from environment variables or default
 */
export function getVectorConfig() {
  return {
    recommendThreshold: RECOMMEND_THRESHOLD,
    recommendK: RECOMMEND_K,
  };
}
