import { Router } from "express";
import { postMockUssd } from "../controllers/exampleController.js";

export const examplesRouter = Router();

examplesRouter.post("/mock-ussd", postMockUssd);
