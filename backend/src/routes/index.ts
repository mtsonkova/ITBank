import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import accountsRouter from './accounts';
import cardsRouter from './cards';
import requestsRouter from './requests';
import transactionsRouter from './transactions';
import managerClientsRouter from './managerClients';
import managerRequestsRouter from './managerRequests';
import adminManagersRouter from './adminManagers';
import adminCustomersRouter from './adminCustomers';
import adminUsersRouter from './adminUsers';
import adminRequestsRouter from './adminRequests';
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
router.use('/admin/managers', adminManagersRouter);
router.use('/admin/customers', adminCustomersRouter);
router.use('/admin/users', adminUsersRouter);
router.use('/admin/requests', adminRequestsRouter);
router.use('/test', testResetRouter);

export default router;
