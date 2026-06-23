import { redirect } from '@sveltejs/kit';

export function GET(): never {
  throw redirect(307, '/#chat');
}
