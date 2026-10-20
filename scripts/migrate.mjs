// Aplica as migrações de drizzle/ à base de dados de produção (Neon) antes do build.
// Sem DATABASE_URL (ex.: antes de criar a BD na Vercel) não faz nada.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

if (!process.env.DATABASE_URL) {
  console.log("[migrate] DATABASE_URL não definida — migrações ignoradas.");
} else {
  await migrate(drizzle(neon(process.env.DATABASE_URL)), { migrationsFolder: "drizzle" });
  console.log("[migrate] migrações aplicadas.");
}
