import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(projectsRouter);

export default router;
