import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

// Custom Clerk middleware or Mock Authentication fallback
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If no auth token, allow guest/mock session or reject
  if (!token) {
    // If we want this to be extremely easy to test locally, we can auto-assign a mock user
    const guestUser = req.headers['x-guest-username'] || 'Guest_' + Math.floor(1000 + Math.random() * 9000);
    req.user = {
      id: `guest_${guestUser}`,
      username: guestUser as string,
      email: `${guestUser}@gesture-drive-local.io`,
      role: 'player'
    };
    return next();
  }

  // Check if it is a mock token for local testing
  if (token.startsWith('mock-token-')) {
    const username = token.replace('mock-token-', '');
    req.user = {
      id: `mock_id_${username}`,
      username: username,
      email: `${username}@gesture-drive-local.io`,
      role: username === 'admin' ? 'admin' : 'player'
    };
    return next();
  }

  // Attempt real JWT verify (in real deployment we verify Clerk's public key)
  try {
    const clerkPublicKey = process.env.CLERK_JWT_PUBLIC_KEY;
    if (clerkPublicKey) {
      // Clean up public key spacing if it's formatted as string block
      const formattedKey = clerkPublicKey.replace(/\\n/g, '\n');
      const decoded = jwt.verify(token, formattedKey) as any;
      
      req.user = {
        id: decoded.sub,
        username: decoded.username || decoded.email?.split('@')[0] || 'Player',
        email: decoded.email || '',
        role: decoded.role || 'player'
      };
      return next();
    } else {
      // Fallback decode if no key is defined (for dev simplicity)
      const decoded = jwt.decode(token) as any;
      if (decoded) {
        req.user = {
          id: decoded.sub || 'guest_user',
          username: decoded.username || 'Player',
          email: decoded.email || '',
          role: decoded.role || 'player'
        };
      } else {
        req.user = {
          id: 'guest_user',
          username: 'GuestPlayer',
          email: 'guest@gesture-drive.io',
          role: 'player'
        };
      }
      return next();
    }
  } catch (error) {
    console.error('JWT Verification Error:', error);
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}
