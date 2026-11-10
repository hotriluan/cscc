import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@cscc/shared';
import { JwtPayload, verifyJwtToken } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      userRole: UserRole;
      authUser?: JwtPayload;
      salesmanName?: string | null;
    }
  }
}

const VALID_ROLES: UserRole[] = ['TECHNICAL', 'SALES', 'PROJECT_LEADER', 'ADMIN'];

/**
 * Extracts UserRole from `Authorization: Bearer <jwt>` (highest priority) or fallback `x-user-role` / `role` query parameter.
 * 1. Verified JWT session (`Authorization: Bearer <token>`) from PostgreSQL `User` table takes strict precedence and locks `userRole` and `salesmanName`.
 * 2. Fallback header/query override (`x-user-role` / `role`) is used only when no valid Bearer token is present (for automated tests).
 * Defaults to `PROJECT_LEADER` when omitted so standard testing works seamlessly,
 * while strictly enforcing `TECHNICAL` restrictions whenever `TECHNICAL` is active.
 */
export function extractRoleMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let tokenRole: UserRole | undefined;
  let tokenSalesman: string | null | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyJwtToken(token);
    if (payload && VALID_ROLES.includes(payload.role)) {
      req.authUser = payload;
      tokenRole = payload.role;
      tokenSalesman = payload.salesmanName ?? null;
    }
  }

  const headerRole = (req.headers['x-user-role'] as string | undefined)?.toUpperCase().trim();
  const queryRole = (req.query.role as string | undefined)?.toUpperCase().trim();
  const headerSalesman = (req.headers['x-salesman-name'] as string | undefined)?.trim();
  const querySalesman = (req.query.salesmanName as string | undefined)?.trim();

  const explicitRole = (headerRole || queryRole) as UserRole | undefined;
  if (tokenRole) {
    req.userRole = tokenRole;
    req.salesmanName = tokenSalesman ?? null;
  } else if (explicitRole && VALID_ROLES.includes(explicitRole)) {
    req.userRole = explicitRole;
    req.salesmanName = headerSalesman || querySalesman || null;
  } else {
    req.userRole = 'PROJECT_LEADER';
    req.salesmanName = headerSalesman || querySalesman || null;
  }

  next();
}

/**
 * Restricts User Account management (viewing, adding, editing, deleting users) to ADMIN role only.
 * Returns `403 Forbidden` if user is not ADMIN.
 */
export function requireAdminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({
      error: 'FORBIDDEN_ADMIN_ACCESS',
      message:
        'Chỉ có tài khoản Quản trị viên (ADMIN) mới có quyền truy cập và thao tác Quản lý Tài khoản (User Accounts).'
    });
    return;
  }
  next();
}

/**
 * Strict variant for sensitive routes (backup/restore): only a verified JWT whose role is ADMIN
 * passes. The `x-user-role` header and `?role=` query override are ignored entirely.
 */
export function requireAdminJwt(req: Request, res: Response, next: NextFunction): void {
  if (req.authUser?.role !== 'ADMIN') {
    res.status(403).json({
      error: 'FORBIDDEN_ADMIN_ACCESS',
      message: 'Chỉ tài khoản Quản trị viên (ADMIN) đăng nhập hợp lệ mới được truy cập chức năng Sao lưu & Phục hồi.'
    });
    return;
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
        'Tài khoản Kỹ thuật viên (TECHNICAL) chỉ được phép truy cập Qui Trình Sơn (Coating Schedule) & BOM kỹ thuật, không có quyền xem bảng Coating Cost (VND/m²).'
    });
    return;
  }
  next();
}

/**
 * Restricts revision status transitions (`DRAFT` <-> `APPROVED` <-> `INACTIVE`)
 * strictly to `PROJECT_LEADER` and `ADMIN` roles.
 * Blocks `TECHNICAL` (TA) and `SALES` roles with `403 Forbidden`.
 */
export function requireStatusChangeAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole !== 'PROJECT_LEADER' && req.userRole !== 'ADMIN') {
    res.status(403).json({
      error: 'FORBIDDEN_STATUS_CHANGE',
      message:
        'Technical (TA) and Sales accounts are not permitted to change revision status. Only Project Leader and Admin can perform this action. / Tài khoản Kỹ thuật viên (TECHNICAL) và Kinh doanh (SALES) không có quyền thay đổi trạng thái phê duyệt của hồ sơ. Chỉ Project Leader và Admin mới được phép thực hiện.'
    });
    return;
  }
  next();
}
