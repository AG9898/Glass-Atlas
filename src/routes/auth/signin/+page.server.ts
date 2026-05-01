import { signIn } from '../../../auth';
import type { Actions, PageServerLoad } from './$types';

/**
 * Reads the callbackUrl from the query string so the page can pass it
 * back through the form to Auth.js via the redirectTo field.
 * Defaults to /admin so a bare /auth/signin visit always lands on the
 * admin dashboard after a successful GitHub sign-in.
 */
export const load: PageServerLoad = async ({ url }) => {
  const callbackUrl = url.searchParams.get('callbackUrl') || '/admin';
  return { callbackUrl };
};

/**
 * Delegates to the Auth.js signIn action. The form must include:
 *   - providerId: the OAuth provider (github)
 *   - redirectTo: destination after successful sign-in
 */
export const actions: Actions = {
  default: signIn,
};
