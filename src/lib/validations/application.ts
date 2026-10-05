import { z } from "zod";

const nameRegex = /^[A-Za-z\s\-'.]+$/;
const mobileRegex = /^\d{10}$/;
const pincodeRegex = /^\d{6}$/;
const textOnlyRegex = /^[A-Za-z\s\-'.]+$/;

export const onboardingSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Required")
    .max(50)
    .regex(nameRegex, "Letters only"),
  lastName: z
    .string()
    .trim()
    .min(1, "Required")
    .max(50)
    .regex(nameRegex, "Letters only"),
  mobile: z.string().regex(mobileRegex, "Must be exactly 10 digits"),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  reason: z.string().trim().min(1, "Required").max(1000),
  turnstileToken: z.string().min(1, "Turnstile verification required"),
});


// ─── Application step schemas (individual, for per-step validation) ──────────

export const step1Schema = z.object({
  program: z.enum(["EGX 100", "EDEX Next"], { required_error: "Select a program" }),
});

export const step2Schema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Required")
    .max(50)
    .regex(nameRegex, "Letters and spaces only"),
  lastName: z
    .string()
    .trim()
    .min(1, "Required")
    .max(50)
    .regex(nameRegex, "Letters and spaces only"),
  dob: z.string()
    .refine((val) => !isNaN(new Date(val).getTime()), "Invalid date format. Use YYYY-MM-DD")
    .refine((val) => {
      const d = new Date(val);
      const now = new Date();
      if (d > now) return false; // No future dates
      const age = now.getFullYear() - d.getFullYear();
      const hasBirthdayPassed =
        now.getMonth() > d.getMonth() ||
        (now.getMonth() === d.getMonth() && now.getDate() >= d.getDate());
      return hasBirthdayPassed ? age >= 18 : age - 1 >= 18;
    }, "Applicant must be at least 18 years old"),
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Select a gender" }),
});

export const step3Schema = z.object({
  guardianName: z
    .string()
    .trim()
    .min(1, "Required")
    .max(100)
    .regex(nameRegex, "Letters and spaces only"),
  guardianContact: z.string().regex(mobileRegex, "Must be exactly 10 digits"),
});

export const step4Schema = z.object({
  mobile: z.string().regex(mobileRegex, "Must be exactly 10 digits"),
  secondMobile: z
    .string()
    .regex(mobileRegex, "Must be exactly 10 digits")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Invalid email"),
});

export const step5Schema = z.object({
  houseName: z.string().trim().min(1, "Required").max(100),
  area: z.string().trim().min(1, "Required").max(100),
  postOffice: z.string().trim().min(1, "Required").max(100),
  district: z.string().trim().min(1, "Required").max(100),
  state: z.string().trim().min(1, "Required").max(100),
  pincode: z.string().regex(pincodeRegex, "Must be exactly 6 digits"),
});

export const step6Schema = z.object({
  highestQualification: z.enum(["UG", "PG", "SSLC", "+2", "Custom"], {
    required_error: "Select a qualification",
  }),
  customQualification: z
    .string()
    .trim()
    .max(100)
    .regex(textOnlyRegex, "No numbers allowed")
    .optional()
    .or(z.literal("")),
});

// ─── Full application schema (used server-side for final validation) ──────────
export const fullApplicationSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema)
  .superRefine((data, ctx) => {
    if (
      data.highestQualification === "Custom" &&
      (!data.customQualification || data.customQualification.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Required when Custom is selected",
        path: ["customQualification"],
      });
    }
  });

export type FullApplicationData = z.infer<typeof fullApplicationSchema>;

// Legacy aliases for backward compatibility
export const applicationSchema = fullApplicationSchema;
export type ApplicationFormData = FullApplicationData;
