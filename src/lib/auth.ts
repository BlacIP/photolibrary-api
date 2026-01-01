import { SignJWT, jwtVerify } from 'jose';

const rawSecret = process.env.JWT_SECRET;
if (!rawSecret) {
    throw new Error('JWT_SECRET is required to start the API.');
}

const SECRET_KEY = new TextEncoder().encode(rawSecret);

export interface SessionPayload {
    user: {
        id: string;
        email: string;
        role: string;
    };
    expiresAt: Date;
}

export async function encrypt(payload: SessionPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SECRET_KEY);
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY, {
            algorithms: ['HS256'],
        });
        return payload as unknown as SessionPayload;
    } catch (error) {
        console.error('Failed to verify session:', error);
        return null;
    }
}
