import { HttpError, json, noContent, readJson } from './http.js';
import { hashPin, newSalt, verifyPin, pinIterations } from './crypto.js';
import { validatePin } from './validate.js';
import { publicUser, requireSession } from './auth.js';
import { attemptsPage, userSummary } from './attempts.js';

export async function me(ctx) {
  const user = await requireSession(ctx, { allowPendingPin: true });
  return json(200, { user: publicUser(user) });
}

export async function changePin(ctx) {
  const user = await requireSession(ctx, { allowPendingPin: true });
  const body = await readJson(ctx.request);
  const currentPin = typeof body.currentPin === 'string' ? body.currentPin : '';
  if (!(await verifyPin(currentPin, user))) throw new HttpError(400, 'invalid', { field: 'currentPin' });
  const newPin = validatePin(body.newPin, 'newPin');
  if (newPin === currentPin) throw new HttpError(400, 'invalid', { field: 'newPin' });
  const salt = newSalt();
  const iterations = pinIterations(ctx.env);
  await ctx.db.batch([
    ctx.db.prepare('UPDATE users SET pin_hash = ?, pin_salt = ?, pin_iterations = ?, must_change_pin = 0, updated_at = ? WHERE id = ?')
      .bind(await hashPin(newPin, salt, iterations), salt, iterations, ctx.now.toISOString(), user.id),
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').bind(user.id, ctx.tokenHash),
  ]);
  return noContent();
}

export async function myAttempts(ctx) {
  const user = await requireSession(ctx);
  return json(200, await attemptsPage(ctx.db, user.id, ctx.url));
}

export async function mySummary(ctx) {
  const user = await requireSession(ctx);
  return json(200, await userSummary(ctx.db, user.id));
}
