import express from "express";
import { authenticateUser } from "../../middleware/auth.middleware";

// * post /api/mysql
// * get /api/mysql
const router = express.Router();

router.post("/", authenticateUser);
