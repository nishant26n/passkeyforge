import {
  test as base,
  request as apiRequest,
  expect,
  type APIRequestContext,
} from "@playwright/test";
import {
  closePool,
  deleteOAuthClientsByNames,
  deleteUsersByEmails,
  getUserByEmail,
} from "./db";
import {
  TEST_PASSWORD,
  uniqueClientIp,
  uniqueEmail,
  type TestUser,
} from "./users";

type CreateUser = (options?: {
  password?: string;
  prefix?: string;
}) => Promise<TestUser>;

type NewApiContext = () => Promise<APIRequestContext>;

type Fixtures = {
  /**
   * The X-Forwarded-For value every request in this test carries. The auth
   * routes bucket their IP rate limit on this header, so giving each test its
   * own address keeps one test's failed logins from rate limiting another's.
   */
  clientIp: string;
  /** Marks an address for deletion once the test finishes. */
  trackEmail: (email: string) => void;
  /** Marks an OAuth client name for deletion once the test finishes. */
  trackOAuthClient: (name: string) => void;
  /** Registers a user through the real API and deletes it after the test. */
  createUser: CreateUser;
  /** A second, independently cookied API context — for cross-user tests. */
  newApiContext: NewApiContext;
};

type WorkerFixtures = {
  /** Closes the shared pg pool once the worker is done. */
  dbPool: void;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  dbPool: [
    async ({}, use) => {
      await use();
      await closePool();
    },
    { scope: "worker", auto: true },
  ],

  clientIp: async ({}, use) => {
    await use(uniqueClientIp());
  },

  extraHTTPHeaders: async ({ clientIp }, use) => {
    await use({ "x-forwarded-for": clientIp });
  },

  trackEmail: async ({}, use) => {
    const created: string[] = [];
    await use((email: string) => {
      created.push(email);
    });
    await deleteUsersByEmails(created);
  },

  trackOAuthClient: async ({}, use) => {
    const created: string[] = [];
    await use((name: string) => {
      created.push(name);
    });
    await deleteOAuthClientsByNames(created);
  },

  createUser: async ({ request, trackEmail }, use) => {
    const createUser: CreateUser = async (options = {}) => {
      const email = uniqueEmail(options.prefix);
      const password = options.password ?? TEST_PASSWORD;

      const response = await request.post("/api/auth/register", {
        data: { email, password },
      });
      expect(
        response.status(),
        "test user registration should succeed",
      ).toBe(201);

      const user = await getUserByEmail(email);
      expect(user, "registered user should exist in the database").not.toBeNull();

      trackEmail(email);
      return { id: user!.id, email, password };
    };

    await use(createUser);
  },

  newApiContext: async ({ baseURL }, use) => {
    const contexts: APIRequestContext[] = [];

    const factory: NewApiContext = async () => {
      const context = await apiRequest.newContext({
        baseURL,
        extraHTTPHeaders: { "x-forwarded-for": uniqueClientIp() },
      });
      contexts.push(context);
      return context;
    };

    await use(factory);
    await Promise.all(contexts.map((context) => context.dispose()));
  },
});

export { expect };
