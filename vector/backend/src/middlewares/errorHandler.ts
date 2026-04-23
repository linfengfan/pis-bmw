// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[Error]", err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || "服务器内部错误";

  res.status(statusCode).json({
    detail: message,
    status: "error",
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ detail: "接口不存在", status: "error" });
}