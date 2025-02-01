import { Request, Response, NextFunction } from 'express';

export default function ResponseHeaderMiddleware(req: Request, res: Response, next: NextFunction) {
    
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Amz-Date, Authorization, x-api-key, x-amz-security-token, x-amz-user-agent, cache-control, origin, x-requested-with, accept, auth, cookie, set-cookie');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    next();
}