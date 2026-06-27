import { UserRole } from '../config/constants.js';

export interface AuthUser {
  id: string;
  role: UserRole;
  jti: string;
  sid: string;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: AuthUser;
    }
  }
}
