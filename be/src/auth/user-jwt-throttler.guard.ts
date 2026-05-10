import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Rate-limit key = JWT `sub`, else client IP. */
@Injectable()
export class UserJwtThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { sub?: string } | undefined;
    if (user?.sub) {
      return `user:${user.sub}`;
    }
    const ip = typeof req.ip === 'string' ? req.ip : '';
    const ips = req.ips as string[] | undefined;
    const resolved = ip || (Array.isArray(ips) && ips.length > 0 ? ips[0] : '') || 'unknown';
    return `ip:${resolved}`;
  }
}
