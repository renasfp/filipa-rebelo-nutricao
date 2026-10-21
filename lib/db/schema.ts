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

// ─── Estado operacional (antes no Redis) ───────────────────────────────

/** Contadores com expiração: limites de pedidos e de tentativas. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Chaves de idempotência: um evento (webhook, lembrete…) só é processado uma vez. */
export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Ligação marcação do Cal.com ↔ consulta e cliente no Nutrium (extensão do Chrome). */
export const nutriumSync = pgTable("nutrium_sync", {
  uid: text("uid").primaryKey(),
  nutriumId: text("nutrium_id").notNull(),
  patientId: text("patient_id").notNull(),
  /** Versão da marcação quando foi sincronizada (ver lib/nutrium-sync.ts). */
  version: text("version").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Webhooks recebidos do Cal.com (sem dados pessoais da cliente). */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    triggerEvent: text("trigger_event").notNull(),
    uid: text("uid"),
    status: text("status"),
    startTime: text("start_time"),
    rescheduleUid: text("reschedule_uid"),
    duplicate: boolean("duplicate").notNull().default(false),
  },
  (t) => [index("webhook_events_received_idx").on(t.receivedAt)],
);

/** Lembretes enviados ou simulados. */
export const reminderLog = pgTable(
  "reminder_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    mode: text("mode", { enum: ["simulacao", "whatsapp"] }).notNull(),
    uid: text("uid").notNull(),
    start: text("start").notNull(),
    /** Só os últimos dígitos do telefone. */
    telefone: text("telefone").notNull(),
    ok: boolean("ok").notNull(),
    error: text("error"),
    texto: text("texto").notNull(),
  },
  (t) => [index("reminder_log_at_idx").on(t.at)],
);
