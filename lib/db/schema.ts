import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Base de dados do backoffice (Postgres: Neon em produção, PGlite em desenvolvimento).
// Alterar este ficheiro e correr `npm run db:generate` para criar a migração em drizzle/.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** "admin" (Renato) ou "operacao" (Filipa). */
  role: text("role", { enum: ["admin", "operacao"] }).notNull(),
  passwordHash: text("password_hash").notNull(),
  /** Segredo TOTP cifrado (AES-256-GCM com BACKOFFICE_SECRET); null até configurar o 2FA. */
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  /** Último passo TOTP aceite, para o mesmo código não servir duas vezes. */
  totpLastStep: integer("totp_last_step"),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 do token do cookie (o token em si nunca é guardado). */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** false entre a palavra-passe e o código 2FA. */
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Ex.: "login", "marcacao.confirmar", "utilizador.criar". */
    action: text("action").notNull(),
    target: text("target"),
    details: jsonb("details"),
    ip: text("ip"),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);

export type User = typeof users.$inferSelect;
export type Role = User["role"];
