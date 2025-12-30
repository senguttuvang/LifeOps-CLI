import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/infrastructure/db/schema.ts", "./src/infrastructure/db/signal-schema.ts"],
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:lifeops3.db",
  },
});
