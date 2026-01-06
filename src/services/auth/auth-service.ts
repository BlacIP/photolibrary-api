import { pool } from '../../lib/db';
import bcrypt from 'bcryptjs';
import { encrypt } from '../../lib/auth';
import { AppError } from '../../lib/errors';

export async function loginUser(email: string, password: string) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new AppError('Invalid credentials', 401);
  }

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await encrypt({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    expiresAt: expires,
  });

  return {
    token,
    expires,
    user: {
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      permissions: user.permissions,
    },
  };
}

export async function updateUserProfile({
  userId,
  firstName,
  lastName,
  currentPassword,
  newPassword,
}: {
  userId: string;
  firstName?: string;
  lastName?: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  if (firstName !== undefined || lastName !== undefined) {
    const newName = `${firstName || ''} ${lastName || ''}`.trim();
    if (newName.length > 0) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [newName, userId]);
    }
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new AppError('Current password required', 400);
    }

    const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const valid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!valid) {
      throw new AppError('Incorrect current password', 400);
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, userId]);
  }

  return { success: true };
}
