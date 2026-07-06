import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import {
  AddClientBodySchema,
  OpenClientAccountBodySchema,
  SetInstrumentStatusBodySchema,
  IssueDebitCardBodySchema,
  IssueCreditCardBodySchema,
} from '@banking-simulator/shared-types';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateBody } from '../middleware/validateBody';
import { AppError } from '../lib/AppError';
import prisma from '../lib/prisma';
import {
  requireClientInPortfolio,
  openAccount,
  setAccountStatus,
  issueDebitCard,
  setDebitCardStatus,
  issueCreditCard,
  setCreditCardStatus,
  checkDeletionConditions,
  deleteClient,
} from '../services/managerService';

const router = Router();

// ─── Serializers ──────────────────────────────────────────────────────────────
function serializeAccount(a: {
  id: string;
  customerId: string;
  iban: string;
  type: string;
  status: string;
  balance: Prisma.Decimal;
  createdAt: Date;
}) {
  return {
    id: a.id,
    customerId: a.customerId,
    iban: a.iban,
    type: a.type,
    status: a.status,
    balance: a.balance.toString(),
    createdAt: a.createdAt.toISOString(),
  };
}

function serializeDebitCard(c: {
  id: string;
  bankAccountId: string;
  customerId: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: c.id,
    bankAccountId: c.bankAccountId,
    customerId: c.customerId,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
  };
}

function serializeCreditCard(c: {
  id: string;
  customerId: string;
  status: string;
  creditLimit: Prisma.Decimal;
  outstandingBalance: Prisma.Decimal;
  createdAt: Date;
}) {
  return {
    id: c.id,
    customerId: c.customerId,
    status: c.status,
    creditLimit: c.creditLimit.toString(),
    outstandingBalance: c.outstandingBalance.toString(),
    createdAt: c.createdAt.toISOString(),
  };
}

// ─── GET /api/v1/manager/clients ──────────────────────────────────────────────
router.get('/', authenticate, authorize('account_manager'), async (req, res, next) => {
  try {
    const managerId = req.user!.id;
    const assignments = await prisma.customerAssignment.findMany({
      where: { accountManagerId: managerId },
      include: {
        customer: {
          include: {
            bankAccounts: true,
            debitCards: true,
            creditCards: true,
            customerRequests: { where: { status: 'pending' } },
          },
        },
      },
    });

    const data = assignments.map(({ customer }) => {
      const totalBalance = customer.bankAccounts.reduce((sum, a) => sum + a.balance.toNumber(), 0);
      const hasActiveInstrument =
        customer.bankAccounts.some((a) => a.status === 'active') ||
        customer.debitCards.some((c) => c.status === 'active') ||
        customer.creditCards.some((c) => c.status === 'active');
      const status =
        customer.bankAccounts.length === 0 ? 'new' : hasActiveInstrument ? 'active' : 'inactive';

      const frozenAccountsCount = customer.bankAccounts.filter((a) => a.status === 'frozen').length;
      const frozenCardsCount =
        customer.debitCards.filter((c) => c.status === 'frozen').length +
        customer.creditCards.filter((c) => c.status === 'frozen').length;

      return {
        id: customer.id,
        username: customer.username,
        fullName: customer.fullName,
        accountsCount: customer.bankAccounts.length,
        cardsCount: customer.debitCards.length + customer.creditCards.length,
        totalBalance: totalBalance.toFixed(2),
        pendingRequestsCount: customer.customerRequests.length,
        frozenAccountsCount,
        frozenCardsCount,
        status,
      };
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/manager/clients ─────────────────────────────────────────────
router.post('/', authenticate, authorize('account_manager'), validateBody(AddClientBodySchema), async (req, res, next) => {
  try {
    const managerId = req.user!.id;
    const { fullName, username, password } = req.body as {
      fullName: string;
      username: string;
      password: string;
    };

    const passwordHash = await bcrypt.hash(password, 12);

    let customer;
    try {
      customer = await prisma.user.create({
        data: { fullName, username, passwordHash, role: 'customer' },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(409, 'Username is already taken', 'USERNAME_TAKEN');
      }
      throw err;
    }

    await prisma.customerAssignment.create({
      data: { customerId: customer.id, accountManagerId: managerId },
    });

    res.status(201).json({
      data: {
        id: customer.id,
        username: customer.username,
        fullName: customer.fullName,
        role: customer.role,
      },
      message: 'Customer created successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/manager/clients/:customerId ──────────────────────────────────
router.get('/:customerId', authenticate, authorize('account_manager'), async (req, res, next) => {
  try {
    const managerId = req.user!.id;
    const { customerId } = req.params;
    await requireClientInPortfolio(managerId, customerId);

    const customer = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
    const [accounts, debitCards, creditCards, pendingRequests] = await Promise.all([
      prisma.bankAccount.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } }),
      prisma.debitCard.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } }),
      prisma.creditCard.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } }),
      prisma.request.findMany({ where: { customerId, status: 'pending' }, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
      data: {
        user: {
          id: customer.id,
          username: customer.username,
          fullName: customer.fullName,
          createdAt: customer.createdAt.toISOString(),
        },
        accounts: accounts.map(serializeAccount),
        debitCards: debitCards.map(serializeDebitCard),
        creditCards: creditCards.map(serializeCreditCard),
        pendingRequests: pendingRequests.map((r) => ({
          id: r.id,
          type: r.type,
          status: r.status,
          payload: r.payload,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/manager/clients/:customerId/accounts ───────────────────────
router.post(
  '/:customerId/accounts',
  authenticate,
  authorize('account_manager'),
  validateBody(OpenClientAccountBodySchema),
  async (req, res, next) => {
    try {
      const managerId = req.user!.id;
      const { customerId } = req.params;
      const { type } = req.body as { type: 'savings' | 'current' };

      await requireClientInPortfolio(managerId, customerId);
      const account = await openAccount(customerId, type);
      res.status(201).json({ data: serializeAccount(account) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /api/v1/manager/clients/:customerId/accounts/:accountId ───────────
router.patch(
  '/:customerId/accounts/:accountId',
  authenticate,
  authorize('account_manager'),
  validateBody(SetInstrumentStatusBodySchema),
  async (req, res, next) => {
    try {
      const managerId = req.user!.id;
      const { customerId, accountId } = req.params;
      const { status } = req.body as { status: 'active' | 'frozen' | 'closed' };

      await requireClientInPortfolio(managerId, customerId);
      const account = await setAccountStatus(customerId, accountId, status);
      res.json({ data: serializeAccount(account) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/v1/manager/clients/:customerId/debit-cards ────────────────────
router.post(
  '/:customerId/debit-cards',
  authenticate,
  authorize('account_manager'),
  validateBody(IssueDebitCardBodySchema),
  async (req, res, next) => {
    try {
      const managerId = req.user!.id;
      const { customerId } = req.params;
      const { account_id } = req.body as { account_id: string };

      await requireClientInPortfolio(managerId, customerId);
      const card = await issueDebitCard(customerId, account_id);
      res.status(201).json({ data: serializeDebitCard(card) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /api/v1/manager/clients/:customerId/debit-cards/:cardId ───────────
router.patch(
  '/:customerId/debit-cards/:cardId',
  authenticate,
  authorize('account_manager'),
  validateBody(SetInstrumentStatusBodySchema),
  async (req, res, next) => {
    try {
      const managerId = req.user!.id;
      const { customerId, cardId } = req.params;
      const { status } = req.body as { status: 'active' | 'frozen' | 'closed' };

      await requireClientInPortfolio(managerId, customerId);
      const card = await setDebitCardStatus(customerId, cardId, status);
      res.json({ data: serializeDebitCard(card) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /api/v1/manager/clients/:customerId/credit-cards ───────────────────
router.post(
  '/:customerId/credit-cards',
  authenticate,
  authorize('account_manager'),
  validateBody(IssueCreditCardBodySchema),
  async (req, res, next) => {
    try {
      const managerId = req.user!.id;
      const { customerId } = req.params;
      const { credit_limit } = req.body as { credit_limit: number };

      await requireClientInPortfolio(managerId, customerId);
      const card = await issueCreditCard(customerId, credit_limit);
      res.status(201).json({ data: serializeCreditCard(card) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /api/v1/manager/clients/:customerId/credit-cards/:cardId ──────────
router.patch(
  '/:customerId/credit-cards/:cardId',
  authenticate,
  authorize('account_manager'),
  validateBody(SetInstrumentStatusBodySchema),
  async (req, res, next) => {
    try {
      const managerId = req.user!.id;
      const { customerId, cardId } = req.params;
      const { status } = req.body as { status: 'active' | 'frozen' | 'closed' };

      await requireClientInPortfolio(managerId, customerId);
      const card = await setCreditCardStatus(customerId, cardId, status);
      res.json({ data: serializeCreditCard(card) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /api/v1/manager/clients/:customerId ───────────────────────────────
router.delete('/:customerId', authenticate, authorize('account_manager'), async (req, res, next) => {
  try {
    const managerId = req.user!.id;
    const { customerId } = req.params;
    await requireClientInPortfolio(managerId, customerId);

    const unmet = await checkDeletionConditions(customerId);
    if (unmet.length > 0) {
      res.status(422).json({
        error: 'Cannot delete client: unmet conditions',
        code: 'CLIENT_DELETION_BLOCKED',
        unmet,
      });
      return;
    }

    await deleteClient(customerId);
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
