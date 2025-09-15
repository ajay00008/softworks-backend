import type { Request, Response, NextFunction } from "express";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function deepSanitize(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = deepSanitize(obj[i]);
    }
    return obj;
  }

  if (isPlainObject(obj)) {
    for (const key of Object.keys(obj)) {
      const value = (obj as Record<string, unknown>)[key];
      if (key.startsWith("$") || key.includes(".")) {
        delete (obj as Record<string, unknown>)[key];
        continue;
      }
      (obj as Record<string, unknown>)[key] = deepSanitize(value);
    }
    return obj;
  }

  return obj;
}

export function sanitizeRequests(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") deepSanitize(req.body);
  if (req.params && typeof req.params === "object") deepSanitize(req.params);
  if (req.query && typeof req.query === "object") deepSanitize(req.query as any);
  next();
}


