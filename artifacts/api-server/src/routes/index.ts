import { Router, type IRouter } from "express";
import healthRouter from "./health";
import grudgeRouter from "./grudge";

const router: IRouter = Router();

router.use(healthRouter);
router.use(grudgeRouter);

export default router;
