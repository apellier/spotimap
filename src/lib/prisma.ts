// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Extend the NodeJS.Global interface to include 'prisma'
// Or use 'globalThis' for a more modern approach if preferred by your TS config
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Ensure the prisma instance is re-used during hot-reloading
  // Prevents too many connections during development.
  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient();
  }
  prisma = globalThis.prisma;
}

export default prisma;
