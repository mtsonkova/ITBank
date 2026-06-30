import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import accountsRouter from './accounts';
import cardsRouter from './cards';
import requestsRouter from './requests';
import transactionsRouter from './transactions';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/accounts', accountsRouter);
router.use('/cards', cardsRouter);
router.use('/requests', requestsRouter);
router.use('/transactions', transactionsRouter);

export default router;
