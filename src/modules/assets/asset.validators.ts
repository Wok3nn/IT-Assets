import { z } from "zod";

export const assetSchema = z.object({
  name: z.string().min(2),
  assetTag: z.string().min(1),
});

