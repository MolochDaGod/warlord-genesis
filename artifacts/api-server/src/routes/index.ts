import { Router, type IRouter } from "express";
import healthRouter from "./health";
import grudgeRouter from "./grudge";
import profilesRouter from "./profiles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(grudgeRouter);
router.use(profilesRouter);

export default router;
