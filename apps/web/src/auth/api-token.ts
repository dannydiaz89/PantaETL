import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { apiTokens, users, type DatabaseClient } from "@pantaetl/database";

const API_TOKEN_PREFIX = "pantaetl_";
const API_TOKEN_SECRET_LENGTH = 43;
const MAX_API_TOKEN_NAME_LENGTH = 128;

/** Safe identity resolved from an active API token and its current owner. */
export interface ApiTokenIdentity {
  readonly email: string;
  readonly id: string;
  readonly isAdmin: boolean;
  readonly tokenId: string;
  readonly username: string;
}

/** API-token metadata returned after creating a credential. */
export interface CreatedApiToken {
  readonly createdAt: Date;
  readonly id: string;
  readonly name: string;
  readonly token: string;
}

/** Metadata that can be safely displayed without revealing a credential. */
export interface ApiTokenMetadata {
  readonly createdAt: Date;
  readonly id: string;
  readonly name: string;
  readonly revokedAt: Date | null;
}

/** Creates a high-entropy bearer credential and its non-reversible digest. */
export function generateApiToken(): string {
  return `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** Converts an API credential into the only representation persisted in PostgreSQL. */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Validates a human-recognizable name without accepting unbounded request data. */
export function parseApiTokenName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("An API token name is required.");
  }

  const name = value.trim();
  if (name.length === 0 || name.length > MAX_API_TOKEN_NAME_LENGTH) {
    throw new Error("API token names must be between 1 and 128 characters.");
  }

  return name;
}

/** Persists a token digest and returns the plaintext credential exactly once. */
export async function createApiToken(
  db: DatabaseClient,
  input: { readonly name: string; readonly ownerUserId: string },
): Promise<CreatedApiToken> {
  const token = generateApiToken();
  const [created] = await db
    .insert(apiTokens)
    .values({ name: input.name, ownerUserId: input.ownerUserId, tokenHash: hashApiToken(token) })
    .returning({ createdAt: apiTokens.createdAt, id: apiTokens.id, name: apiTokens.name });

  if (created === undefined) {
    throw new Error("API token creation did not return a record.");
  }

  return { ...created, token };
}

/** Lists a user's token metadata without selecting hashes or plaintext credentials. */
export async function listApiTokens(db: DatabaseClient, ownerUserId: string): Promise<readonly ApiTokenMetadata[]> {
  return db
    .select({ createdAt: apiTokens.createdAt, id: apiTokens.id, name: apiTokens.name, revokedAt: apiTokens.revokedAt })
    .from(apiTokens)
    .where(eq(apiTokens.ownerUserId, ownerUserId))
    .orderBy(apiTokens.createdAt);
}

/** Marks one user-owned credential unusable without deleting its audit metadata. */
export async function revokeApiToken(db: DatabaseClient, input: { readonly ownerUserId: string; readonly tokenId: string }): Promise<boolean> {
  const revoked = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, input.tokenId), eq(apiTokens.ownerUserId, input.ownerUserId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });

  return revoked.length === 1;
}

/** Resolves a live user identity from a valid, non-revoked Bearer credential. */
export async function authenticateApiToken(db: DatabaseClient, authorization: string | null): Promise<ApiTokenIdentity | null> {
  const token = extractBearerToken(authorization);
  if (token === null) {
    return null;
  }

  const [identity] = await db
    .select({
      email: users.email,
      id: users.id,
      isAdmin: users.isAdmin,
      tokenId: apiTokens.id,
      username: users.username,
    })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.ownerUserId, users.id))
    .where(and(eq(apiTokens.tokenHash, hashApiToken(token)), isNull(apiTokens.revokedAt)));

  return identity ?? null;
}

/** Extracts only the application-issued Bearer format; password schemes never authenticate APIs. */
export function extractBearerToken(authorization: string | null): string | null {
  if (authorization === null) {
    return null;
  }

  const match = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(authorization);
  if (match === null) {
    return null;
  }

  const token = match[1];
  if (token === undefined || !token.startsWith(API_TOKEN_PREFIX) || token.length !== API_TOKEN_PREFIX.length + API_TOKEN_SECRET_LENGTH) {
    return null;
  }

  return token;
}
