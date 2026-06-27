import jwt from "jsonwebtoken";
import User from "../models/User.js";

function normalizeCompanies(companies) {
  return Array.isArray(companies) ? companies.filter(Boolean) : [];
}

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("email role companies");
    if (!user) return res.status(401).json({ error: "Invalid or expired token" });

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      companies: normalizeCompanies(user.companies),
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function userCanAccessCompany(user, company) {
  if (!company) return false;
  if (user?.role === "admin") return true;
  return normalizeCompanies(user?.companies).includes(company);
}

export function companyFilterForUser(user, requestedCompany) {
  if (user?.role === "admin") {
    return requestedCompany ? { company: requestedCompany } : {};
  }

  const companies = normalizeCompanies(user?.companies);
  if (requestedCompany) {
    return companies.includes(requestedCompany) ? { company: requestedCompany } : null;
  }

  return { company: { $in: companies } };
}

export function requireCompanyAccess(req, res, next) {
  if (userCanAccessCompany(req.user, req.body.company)) {
    return next();
  }

  return res.status(403).json({ error: "Company access denied" });
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}
