import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@cscc/shared';
import { JwtPayload, verifyJwtToken } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      userRole: UserRole;
      authUser?: JwtPayload;
    }
  }
}

const VALID_ROLES: UserRole[] = ['TECHNICAL', 'SALES', 'PROJECT_LEADER', 'ADMIN'];

/**
 * Extracts UserRole from `x-user-role` header, `role` query parameter, or `Authorization: Bearer <jwt>`.
 * Supports dual-mode operation:
 * 1. Verified JWT session (`Authorization: Bearer <token>`) from PostgreSQL `User` table.
 * 2. Quick RBAC Role Switcher override (`x-user-role` header / `role` query param) for fast demo/testing.
 * Defaults to `PROJECT_LEADER` when omitted so standard testing works seamlessly,
 * while strictly enforcing `TECHNICAL` restrictions whenever `TECHNICAL` is active.
 */
export function extractRoleMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let tokenRole: UserRole | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyJwtToken(token);
    if (payload && VALID_ROLES.includes(payload.role)) {
      req.authUser = payload;
      tokenRole = payload.role;
    }
  }

  const headerRole = (req.headers['x-user-role'] as string | undefined)?.toUpperCase().trim();
  const queryRole = (req.query.role as string | undefined)?.toUpperCase().trim();

  const explicitRole = (headerRole || queryRole) as UserRole | undefined;
  if (explicitRole && VALID_ROLES.includes(explicitRole)) {
    req.userRole = explicitRole;
  } else if (tokenRole) {
    req.userRole = tokenRole;
  } else {
    req.userRole = 'PROJECT_LEADER';
  }

  next();
}

/**
 * Blocks `TECHNICAL` role from accessing Coating Cost endpoints (`403 Forbidden`).
 * Only `SALES`, `PROJECT_LEADER`, and `ADMIN` can access Coating Cost (VND/m2).
 */
export function requireCostAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole === 'TECHNICAL') {
    res.status(403).json({
      error: 'FORBIDDEN_COST_ACCESS',
      message:
        'Tài khoản Kỹ thuật viên (TECHNICAL) chỉ được phép truy cập Coating Schedule & BOM kỹ thuật, không có quyền xem bảng Coating Cost (VND/m²).'
    });
    return;
  }
  next();
}
