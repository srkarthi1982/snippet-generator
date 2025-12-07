/**
 * Snippet Generator - store and reuse code / text snippets.
 *
 * Design goals:
 * - A user can have multiple snippet collections (e.g. "Astro snippets", "SQL").
 * - Each snippet can store language, tags, and usage notes.
 * - Future support for public/hidden sharing flags.
 */

import { defineTable, column, NOW } from "astro:db";

export const SnippetCollections = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    name: column.text(),                          // e.g. "Astro DB helpers"
    description: column.text({ optional: true }),
    icon: column.text({ optional: true }),        // examples: "puzzle", "laptop"
    isDefault: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const Snippets = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    collectionId: column.text({
      references: () => SnippetCollections.columns.id,
    }),
    userId: column.text(),                        // duplicate for simpler queries
    title: column.text(),                         // short label
    language: column.text({ optional: true }),    // "js", "ts", "sql", "text"
    content: column.text(),                       // the snippet itself
    description: column.text({ optional: true }),
    tags: column.text({ optional: true }),        // JSON or comma-separated
    isFavorite: column.boolean({ default: false }),
    isArchived: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const tables = {
  SnippetCollections,
  Snippets,
} as const;
