import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import accountsRouter from './accounts';
import cardsRouter from './cards';
import requestsRouter from './requests';
import transactionsRouter from './transactions';
import managerClientsRouter from './managerClients';
import managerRequestsRouter from './managerRequests';
import managerTransactionsRouter from './managerTransactions';
import adminManagersRouter from './adminManagers';
import adminCustomersRouter from './adminCustomers';
import adminUsersRouter from './adminUsers';
import adminRequestsRouter from './adminRequests';
import adminTransactionsRouter from './adminTransactions';
import testResetRouter from './testReset';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/accounts', accountsRouter);
router.use('/cards', cardsRouter);
router.use('/requests', requestsRouter);
router.use('/transactions', transactionsRouter);
router.use('/manager/clients', managerClientsRouter);
router.use('/manager/requests', managerRequestsRouter);
router.use('/manager/transactions', managerTransactionsRouter);
router.use('/admin/managers', adminManagersRouter);
router.use('/admin/customers', adminCustomersRouter);
router.use('/admin/users', adminUsersRouter);
router.use('/admin/requests', adminRequestsRouter);
router.use('/admin/transactions', adminTransactionsRouter);
router.use('/test', testResetRouter);

export default router;
