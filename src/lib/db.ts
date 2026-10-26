import { hasSupabase, supabase } from "./supabase";
import type { TableName, Tables } from "./types";

type Row<T extends TableName> = Tables[T];

interface Store {
  list<T extends TableName>(table: T): Promise<Row<T>[]>;
  insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove(table: TableName, id: string): Promise<void>;
}

const supabaseStore: Store = {
  async list(table) {
    const { data, error } = await supabase().from(table).select("*").order("created_at");
    if (error) throw error;
    return data ?? [];
  },
  async insert(table, row) {
    const { data, error } = await supabase().from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async update(table, id, patch) {
    const { data, error } = await supabase().from(table).update(patch as never).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(table, id) {
    const { error } = await supabase().from(table).delete().eq("id", id);
    if (error) throw error;
  },
};

const PREFIX = "amelie-mhh:";

function readLocal<T>(table: TableName): T[] {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + table) ?? "[]");
  } catch {
    return [];
  }
}

function writeLocal(table: TableName, rows: unknown[]) {
  localStorage.setItem(PREFIX + table, JSON.stringify(rows));
}

const localStore: Store = {
  async list(table) {
    return readLocal(table);
  },
  async insert(table, row) {
    const stored = { created_at: new Date().toISOString(), ...row };
    writeLocal(table, [...readLocal(table), stored]);
    return stored;
  },
  async update(table, id, patch) {
    const rows = readLocal<Row<typeof table>>(table);
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) throw new Error("Eintrag nicht gefunden");
    rows[index] = { ...rows[index], ...patch };
    writeLocal(table, rows);
    return rows[index];
  },
  async remove(table, id) {
    writeLocal(
      table,
      readLocal<{ id: string }>(table).filter((r) => r.id !== id),
    );
  },
};

export const db: Store = hasSupabase ? supabaseStore : localStore;

export function newId(): string {
  return crypto.randomUUID();
}
