import express from "express";
import { authenticateUser } from "../../middleware/auth.middleware";

const router = express.Router();

router.post("/", authenticateUser);
