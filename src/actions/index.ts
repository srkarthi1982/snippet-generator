import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { and, db, desc, eq, SnippetCollections, Snippets } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function ensureCollectionOwned(collectionId: string, userId: string) {
  const [collection] = await db
    .select()
    .from(SnippetCollections)
    .where(
      and(
        eq(SnippetCollections.id, collectionId),
        eq(SnippetCollections.userId, userId)
      )
    );

  if (!collection) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Collection not found.",
    });
  }

  return collection;
}

async function ensureSnippetOwned(snippetId: string, userId: string) {
  const [snippet] = await db
    .select()
    .from(Snippets)
    .where(and(eq(Snippets.id, snippetId), eq(Snippets.userId, userId)));

  if (!snippet) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Snippet not found.",
    });
  }

  return snippet;
}

export const server = {
  createSnippetCollection: defineAction({
    input: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      if (input.isDefault) {
        await db
          .update(SnippetCollections)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(SnippetCollections.userId, user.id));
      }

      const collection = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: input.name,
        description: input.description,
        icon: input.icon,
        isDefault: input.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof SnippetCollections.$inferInsert;

      await db.insert(SnippetCollections).values(collection);

      return { success: true, data: { collection } };
    },
  }),

  updateSnippetCollection: defineAction({
    input: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await ensureCollectionOwned(input.id, user.id);
      const now = new Date();
      const updateData: Partial<typeof SnippetCollections.$inferInsert> = {
        updatedAt: now,
      };

      if (typeof input.name === "string") updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

      if (input.isDefault) {
        await db
          .update(SnippetCollections)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(SnippetCollections.userId, user.id));
      }

      await db
        .update(SnippetCollections)
        .set(updateData)
        .where(eq(SnippetCollections.id, existing.id));

      const [collection] = await db
        .select()
        .from(SnippetCollections)
        .where(eq(SnippetCollections.id, existing.id));

      return { success: true, data: { collection } };
    },
  }),

  listMySnippetCollections: defineAction({
    input: z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const offset = (input.page - 1) * input.pageSize;

      const items = await db
        .select()
        .from(SnippetCollections)
        .where(eq(SnippetCollections.userId, user.id))
        .orderBy(desc(SnippetCollections.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      return { success: true, data: { items, total: items.length } };
    },
  }),

  createSnippet: defineAction({
    input: z.object({
      collectionId: z.string().min(1),
      title: z.string().min(1),
      language: z.string().optional(),
      content: z.string().min(1),
      description: z.string().optional(),
      tags: z.string().optional(),
      isFavorite: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await ensureCollectionOwned(input.collectionId, user.id);
      const now = new Date();

      const snippet = {
        id: crypto.randomUUID(),
        collectionId: input.collectionId,
        userId: user.id,
        title: input.title,
        language: input.language,
        content: input.content,
        description: input.description,
        tags: input.tags,
        isFavorite: input.isFavorite ?? false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof Snippets.$inferInsert;

      await db.insert(Snippets).values(snippet);

      return { success: true, data: { snippet } };
    },
  }),

  updateSnippet: defineAction({
    input: z.object({
      id: z.string().min(1),
      title: z.string().min(1).optional(),
      language: z.string().optional(),
      content: z.string().min(1).optional(),
      description: z.string().optional(),
      tags: z.string().optional(),
      isFavorite: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      collectionId: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await ensureSnippetOwned(input.id, user.id);
      const now = new Date();
      const updateData: Partial<typeof Snippets.$inferInsert> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.language !== undefined) updateData.language = input.language;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.tags !== undefined) updateData.tags = input.tags;
      if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;
      if (input.isArchived !== undefined) updateData.isArchived = input.isArchived;

      if (
        input.collectionId !== undefined &&
        input.collectionId !== existing.collectionId
      ) {
        await ensureCollectionOwned(input.collectionId, user.id);
        updateData.collectionId = input.collectionId;
      }

      await db
        .update(Snippets)
        .set(updateData)
        .where(eq(Snippets.id, existing.id));

      const [snippet] = await db
        .select()
        .from(Snippets)
        .where(eq(Snippets.id, existing.id));

      return { success: true, data: { snippet } };
    },
  }),

  archiveSnippet: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const existing = await ensureSnippetOwned(input.id, user.id);
      const now = new Date();

      await db
        .update(Snippets)
        .set({ isArchived: true, updatedAt: now })
        .where(eq(Snippets.id, existing.id));

      return { success: true, data: { id: existing.id } };
    },
  }),

  listSnippets: defineAction({
    input: z.object({
      collectionId: z.string().optional(),
      includeArchived: z.boolean().default(false),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const filters = [eq(Snippets.userId, user.id)];

      if (input.collectionId) {
        await ensureCollectionOwned(input.collectionId, user.id);
        filters.push(eq(Snippets.collectionId, input.collectionId));
      }

      if (!input.includeArchived) {
        filters.push(eq(Snippets.isArchived, false));
      }

      const offset = (input.page - 1) * input.pageSize;

      const items = await db
        .select()
        .from(Snippets)
        .where(and(...filters))
        .orderBy(desc(Snippets.updatedAt))
        .limit(input.pageSize)
        .offset(offset);

      return { success: true, data: { items, total: items.length } };
    },
  }),

  getSnippet: defineAction({
    input: z.object({ id: z.string().min(1) }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const snippet = await ensureSnippetOwned(input.id, user.id);

      return { success: true, data: { snippet } };
    },
  }),
};
