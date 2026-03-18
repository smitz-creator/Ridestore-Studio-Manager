import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import projectsRouter from "./projects";
import productsRouter from "./products";
import commentsRouter from "./comments";
import sessionsRouter from "./sessions";
import importRouter from "./import";
import captureSessionsRouter from "./capture-sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(projectsRouter);
router.use(productsRouter);
router.use(commentsRouter);
router.use(sessionsRouter);
router.use(importRouter);
router.use(captureSessionsRouter);

export default router;
