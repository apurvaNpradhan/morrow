import { describe, expect, it, vi } from "vite-plus/test";
import { prepareDatabaseStartup } from "./prepare-database-startup";

describe("prepare-database-startup", () => {
  it("waits for database readiness before running startup migrations", async () => {
    const events: string[] = [];

    await prepareDatabaseStartup({
      databaseUrl: "postgresql://morrow:password@postgres:5432/morrow",
      waitForDatabase: async () => {
        events.push("wait");
      },
      runStartupMigrations: async () => {
        events.push("migrate");
      },
      logInfo: () => {
        events.push("log");
      },
    });

    expect(events).toEqual(["log", "wait", "migrate"]);
  });

  it("surfaces safe database details and skips migrations when readiness fails", async () => {
    const waitError = new Error("getaddrinfo EAI_AGAIN postgres");
    const runStartupMigrations = vi.fn();
    const logError = vi.fn();

    await expect(
      prepareDatabaseStartup({
        databaseUrl: "postgresql://morrow:password@postgres:5432/morrow",
        waitForDatabase: async () => {
          throw waitError;
        },
        runStartupMigrations,
        logError,
      }),
    ).rejects.toThrow(
      "Database startup failed for postgres:5432/morrow. Check DATABASE_URL and that the database is reachable from this process.",
    );

    expect(runStartupMigrations).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "❌ Database readiness check failed",
      expect.objectContaining({
        host: "postgres",
        port: 5432,
        database: "morrow",
        username: "morrow",
      }),
      waitError,
    );
  });

  it("logs migration failures separately from readiness failures", async () => {
    const migrationError = new Error("permission denied for schema public");
    const logError = vi.fn();

    await expect(
      prepareDatabaseStartup({
        databaseUrl: "postgresql://morrow:password@postgres:5432/morrow",
        waitForDatabase: async () => undefined,
        runStartupMigrations: async () => {
          throw migrationError;
        },
        logError,
      }),
    ).rejects.toThrow("Database migrations failed for postgres:5432/morrow.");

    expect(logError).toHaveBeenCalledWith(
      "❌ Database migrations failed",
      expect.objectContaining({
        host: "postgres",
        port: 5432,
        database: "morrow",
        username: "morrow",
      }),
      migrationError,
    );
  });
});
