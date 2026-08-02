import { z } from "zod";

export const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
export const password = z.string().min(8).max(128);
const text = z.string().trim().max(1000);
const company = z.string().trim().min(1).max(120);
const index = z.number().int().min(0);

export const schemas = {
  register: z.object({ email, password, fullName: text.optional(), role: z.enum(["admin", "user"]).optional(), companies: z.array(company).max(100).optional() }),
  login: z.object({ email, password: z.string().min(1).max(128) }),
  forgot: z.object({ email }),
  reset: z.object({ token: z.string().min(1).max(4096), password }),
  me: z.object({ email: email.optional(), password: password.optional(), fullName: text.optional() }),
  company: z.object({ name: company.optional(), workStart: text.optional(), workEnd: text.optional(), breaks: z.array(z.object({ from: text, to: text })).max(20).optional(), workDays: z.array(z.number().int().min(0).max(6)).max(7).optional() }),
  client: z.object({ clientType: z.enum(["company", "person"]).optional(), clientName: text.optional(), country: text.optional(), adressa: text.optional(), owner: text.optional(), contact: text.optional(), email: z.union([email, z.literal("")]).optional(), oib: text.optional(), company: company.optional(), responsiblePersons: z.array(z.object({ fullName: text.optional(), email: z.union([email, z.literal("")]).optional(), contact: text.optional(), note: text.optional() })).max(100).optional() }),
  worker: z.object({ fullName: text.optional(), email: z.union([email, z.literal("")]).optional(), address: text.optional(), contact: text.optional(), jobPosition: text.optional(), busy: z.boolean().optional(), freeIn: text.optional(), company: company.optional(), ratings: z.record(z.string(), z.number().min(0).max(100)).optional(), operations: z.record(z.string(), z.boolean()).optional(), projectsCompleted: z.number().int().min(0).optional() }),
  workerRating: z.object({ operation: z.enum(["pipeCutting", "sheetCutting", "welding", "bending", "grinding", "drilling", "assembly"]), rating: z.number().min(0).max(100) }),
  warehouse: z.object({ type: text.optional(), name: text.optional(), specs: text.optional(), qty: z.number().min(0).optional(), company: company.optional() }),
  project: z.object({ rn: text.optional(), name: text.optional(), client: text.optional(), responsible: text.optional(), company: company.optional(), status: text.optional(), startedAt: z.coerce.date().nullable().optional(), pausedAt: z.coerce.date().nullable().optional(), totalPausedMs: z.number().min(0).optional(), drawings: z.array(z.record(z.string(), z.unknown())).max(1000).optional() }),
  completeTask: z.object({ drawingIndex: index, workerIndex: index, completedAt: z.coerce.date().optional() }),
  removeWorker: z.object({ drawingIndex: index, workerIndex: index }),
};

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
      });
    }
    req.body = result.data;
    return next();
  };
}
