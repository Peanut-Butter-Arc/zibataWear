import { z } from "zod";
import { ZIBATA_MEETUP_ZONES } from "../constants/zibata";

export const categoryEnum = z.enum([
  "hoodies",
  "sneakers",
  "jackets",
  "dresses",
  "denim",
  "tops",
  "sportswear",
  "accessories",
]);

export const conditionEnum = z.enum(["new_with_tags", "like_new", "good", "fair"]);

export const listingModeEnum = z.enum(["buy", "rent", "both"]);

export const sendOtpSchema = z.object({
  email: z.string().trim().email("Ingresa un correo electrónico válido."),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email("Correo inválido."),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe tener exactamente 6 dígitos."),
});

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Tu nombre debe tener al menos 2 caracteres.")
    .max(80, "Máximo 80 caracteres."),
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres.")
    .max(24, "Máximo 24 caracteres.")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo.")
    .optional()
    .or(z.literal("")),
  university: z.string().trim().min(2).max(120).optional(),
  major: z.string().trim().max(120).optional(),
  campus_zone: z.enum(ZIBATA_MEETUP_ZONES).optional(),
  bio: z.string().trim().max(280, "Máximo 280 caracteres.").optional(),
});

export const pricingRequestSchema = z.object({
  category: categoryEnum,
  brand: z.string().trim().min(1, "Indica la marca.").max(60),
  condition: conditionEnum,
  size: z.string().trim().max(20).optional(),
  originalPriceMxn: z.number().int().min(100).max(200000).nullable().optional(),
  meetupZone: z.string().trim().max(80).optional(),
  listingMode: listingModeEnum.optional(),
});

export const createListingSchema = z
  .object({
    title: z.string().trim().min(4, "Título muy corto.").max(90, "Máximo 90 caracteres."),
    description: z
      .string()
      .trim()
      .min(10, "Cuéntanos un poco más sobre la prenda.")
      .max(1200, "Máximo 1200 caracteres."),
    brand: z.string().trim().min(1, "Ingresa la marca.").max(60),
    category: categoryEnum,
    size: z.string().trim().min(1, "Selecciona la talla.").max(20),
    condition: conditionEnum,
    listing_mode: listingModeEnum,
    sale_price_mxn: z.number().int().min(50).max(150000).nullable().optional(),
    rent_price_per_day_mxn: z.number().int().min(40).max(50000).nullable().optional(),
    security_deposit_mxn: z.number().int().min(0).max(50000).default(0),
    original_price_mxn: z.number().int().min(50).max(200000).nullable().optional(),
    recommended_sale_price_mxn: z.number().int().positive().nullable().optional(),
    recommended_rent_price_mxn: z.number().int().positive().nullable().optional(),
    meetup_zone: z.enum(ZIBATA_MEETUP_ZONES),
    images: z
      .array(z.string().url("URL de imagen inválida."))
      .min(1, "Sube al menos 1 foto de tu prenda.")
      .max(6, "Máximo 6 fotos."),
    tags: z.array(z.string().trim().max(24)).max(6).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if ((data.listing_mode === "buy" || data.listing_mode === "both") && !data.sale_price_mxn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa un precio de venta en MXN.",
        path: ["sale_price_mxn"],
      });
    }
    if (
      (data.listing_mode === "rent" || data.listing_mode === "both") &&
      !data.rent_price_per_day_mxn
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa una tarifa de renta por día en MXN.",
        path: ["rent_price_per_day_mxn"],
      });
    }
  });

export const updateListingSchema = z.object({
  title: z.string().trim().min(4).max(90).optional(),
  description: z.string().trim().min(10).max(1200).optional(),
  sale_price_mxn: z.number().int().min(50).max(150000).nullable().optional(),
  rent_price_per_day_mxn: z.number().int().min(40).max(50000).nullable().optional(),
  security_deposit_mxn: z.number().int().min(0).max(50000).optional(),
  meetup_zone: z.enum(ZIBATA_MEETUP_ZONES).optional(),
  status: z.enum(["active", "reserved", "rented", "sold", "paused"]).optional(),
});

export const checkoutRequestSchema = z
  .object({
    listingId: z.string().uuid("Prenda inválida."),
    orderType: z.enum(["buy", "rent"]),
    rentalStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    rentalEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    meetupZone: z.enum(ZIBATA_MEETUP_ZONES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === "rent") {
      if (!data.rentalStartDate || !data.rentalEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona fechas de inicio y devolución para rentar.",
          path: ["rentalStartDate"],
        });
      }
    }
  });

export const createConversationSchema = z.object({
  listingId: z.string().uuid("Prenda inválida."),
});

export const sendMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escribe un mensaje.")
    .max(2000, "Máximo 2000 caracteres."),
});
