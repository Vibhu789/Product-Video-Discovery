import { z } from 'zod';

export const searchSchema = z
  .object({
    query: z.string().trim().min(2).max(300).optional(),
    url: z.string().trim().url().max(2000).optional(),
    imageDataUrl: z
      .string()
      .regex(/^data:image\/(jpeg|png|webp|gif);base64,/, 'Image must be a jpeg, png, webp or gif data URL')
      .max(7_000_000)
      .optional(),
    includeSeen: z.boolean().default(false),
    tiktok: z.boolean().default(false),
  })
  .refine((v) => v.query || v.url || v.imageDataUrl, {
    message: 'Provide a product name, a product URL, or an image',
  });