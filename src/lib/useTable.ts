"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { db, newId } from "./db";
import type { TableName, Tables } from "./types";

type Row<T extends TableName> = Tables[T];

interface Entry {
  rows: unknown[] | null;
  error: string | null;
  loading: Promise<void> | null;
}

const cache = new Map<TableName, Entry>();
const listeners = new Set<() => void>();
const EMPTY: Entry = { rows: null, error: null, loading: null };

function entry(table: TableName): Entry {
  return cache.get(table) ?? EMPTY;
}

function set(table: TableName, next: Partial<Entry>) {
  cache.set(table, { ...entry(table), ...next });
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function message(e: unknown) {
  return e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
}

export function load(table: TableName, force = false) {
  const current = entry(table);
  if (current.loading) return current.loading;
  if (current.rows && !force) return Promise.resolve();
  const loading = db
    .list(table)
    .then((rows) => set(table, { rows, error: null, loading: null }))
    .catch((e) => set(table, { error: message(e), loading: null }));
  set(table, { loading });
  return loading;
}

/** Drops every cached table, e.g. after logging out or importing a backup. */
export function resetCache() {
  cache.clear();
  listeners.forEach((l) => l());
}

export function useTable<T extends TableName>(table: T) {
  const state = useSyncExternalStore(
    subscribe,
    () => entry(table),
    () => EMPTY,
  );

  useEffect(() => {
    load(table);
  }, [table, state.rows]);

  const rows = (state.rows ?? []) as Row<T>[];

  const insert = useCallback(
    async (row: Omit<Row<T>, "id"> & { id?: string }) => {
      const created = await db.insert(table, { ...row, id: row.id ?? newId() } as Row<T>);
      set(table, { rows: [...((entry(table).rows ?? []) as Row<T>[]), created] });
      return created;
    },
    [table],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Row<T>>) => {
      const before = (entry(table).rows ?? []) as Row<T>[];
      set(table, { rows: before.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
      try {
        await db.update(table, id, patch);
      } catch (e) {
        set(table, { rows: before, error: message(e) });
        throw e;
      }
    },
    [table],
  );

  const remove = useCallback(
    async (id: string) => {
      const before = (entry(table).rows ?? []) as Row<T>[];
      set(table, { rows: before.filter((r) => r.id !== id) });
      try {
        await db.remove(table, id);
      } catch (e) {
        set(table, { rows: before, error: message(e) });
        throw e;
      }
    },
    [table],
  );

  return {
    rows,
    loaded: state.rows !== null,
    error: state.error,
    insert,
    update,
    remove,
    reload: () => load(table, true),
  };
}
