import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../lib/AppError';

// ─── Managers ───────────────────────────────────────────────────────────────
export async function listManagers() {
  const managers = await prisma.user.findMany({
    where: { role: 'account_manager' },
    include: { managerAssignments: true },
    orderBy: { createdAt: 'asc' },
  });

  return managers.map((m) => ({
    id: m.id,
    username: m.username,
    fullName: m.fullName,
    createdAt: m.createdAt,
    clientCount: m.managerAssignments.length,
  }));
}

export async function createManager(fullName: string, username: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    return await prisma.user.create({
      data: { fullName, username, passwordHash, role: 'account_manager' },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'Username is already taken', 'USERNAME_TAKEN');
    }
    throw err;
  }
}

async function requireManager(managerId: string) {
  const manager = await prisma.user.findUnique({ where: { id: managerId } });
  if (!manager || manager.role !== 'account_manager') {
    throw new AppError(404, 'Account manager not found', 'NOT_FOUND');
  }
  return manager;
}

export async function removeManager(managerId: string) {
  await requireManager(managerId);

  const clientCount = await prisma.customerAssignment.count({ where: { accountManagerId: managerId } });
  if (clientCount > 0) {
    throw new AppError(422, 'Manager has assigned clients', 'MANAGER_HAS_CLIENTS');
  }

  await prisma.user.delete({ where: { id: managerId } });
}

export async function bulkReassignManager(fromManagerId: string, toManagerId: string) {
  if (fromManagerId === toManagerId) {
    throw new AppError(422, 'Source and target manager must be different', 'SAME_MANAGER');
  }
  await requireManager(fromManagerId);
  await requireManager(toManagerId);

  await prisma.customerAssignment.updateMany({
    where: { accountManagerId: fromManagerId },
    data: { accountManagerId: toManagerId },
  });
}

// ─── Customers ──────────────────────────────────────────────────────────────
export async function listCustomers() {
  const customers = await prisma.user.findMany({
    where: { role: 'customer' },
    include: { customerAssignment: { include: { accountManager: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return customers.map((c) => ({
    id: c.id,
    username: c.username,
    fullName: c.fullName,
    createdAt: c.createdAt,
    managerId: c.customerAssignment?.accountManagerId ?? null,
    managerName: c.customerAssignment?.accountManager.fullName ?? null,
  }));
}

export async function createCustomer(
  fullName: string,
  username: string,
  password: string,
  managerId: string,
) {
  await requireManager(managerId);

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

  return customer;
}

export async function reassignCustomer(customerId: string, toManagerId: string) {
  const assignment = await prisma.customerAssignment.findUnique({ where: { customerId } });
  if (!assignment) {
    throw new AppError(404, 'Customer not found', 'NOT_FOUND');
  }
  await requireManager(toManagerId);

  await prisma.customerAssignment.update({
    where: { customerId },
    data: { accountManagerId: toManagerId },
  });
}

// ─── Password reset (any user, no current password required) ─────────────────
export async function resetUserPassword(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'User not found', 'NOT_FOUND');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
