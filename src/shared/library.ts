import { z } from 'zod';

// The Excalidraw library (reusable shapes), stored as JSON. Elements are checked only for the
// fields the server needs; Excalidraw restores the rest when it loads them.

export const MAX_LIBRARY_ITEMS = 500;
export const MAX_ELEMENTS_PER_ITEM = 2_000;

const libraryItemSchema = z
  .object({
    id: z.string().min(1).max(200),
    status: z.enum(['published', 'unpublished']).default('unpublished'),
    created: z.number().finite(),
    name: z.string().max(200).optional(),
    elements: z
      .array(z.object({ type: z.string().min(1).max(40) }).passthrough())
      .max(MAX_ELEMENTS_PER_ITEM),
  })
  .passthrough();

export const libraryPayloadSchema = z.object({
  items: z.array(libraryItemSchema).max(MAX_LIBRARY_ITEMS),
});

export type LibraryPayload = z.infer<typeof libraryPayloadSchema>;
