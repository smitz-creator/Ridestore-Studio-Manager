import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import projectsRouter from "./projects";
import productsRouter from "./products";
import commentsRouter from "./comments";
import sessionsRouter from "./sessions";
import importRouter from "./import";
import captureSessionsRouter from "./capture-sessions";
import retouchSessionsRouter from "./retouch-sessions";
import plannerRouter from "./planner";
import storageRouter from "./storage";
import preProductionRouter from "./pre-production";
import airtableSyncRouter from "./airtable-sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(projectsRouter);
router.use(productsRouter);
router.use(commentsRouter);
router.use(sessionsRouter);
router.use(importRouter);
router.use(captureSessionsRouter);
router.use(retouchSessionsRouter);
router.use(plannerRouter);
router.use(storageRouter);
router.use(preProductionRouter);
router.use(airtableSyncRouter);

export default router;
