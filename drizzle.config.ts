import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/infrastructure/db/schema/index.ts"],
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:lifeops.db",
  },
});
