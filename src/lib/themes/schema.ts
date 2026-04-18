import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color");

export const themeTokensSchema = z.object({
  palette: z.object({
    primary: hex,
    secondary: hex,
    accent: hex,
    bg: hex,
    fg: hex,
  }),
  font: z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
  }),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
