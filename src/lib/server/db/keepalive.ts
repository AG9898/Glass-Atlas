import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './index';

// Pings the DB every 4 minutes to prevent Neon serverless from idling the
// connection pool (Neon drops idle connections after ~5 minutes).
// Only starts if DATABASE_URL is configured — safe to import in dev without a DB.
if (env.DATABASE_URL) {
	setInterval(async () => {
		try {
			await db.execute(sql`SELECT 1`);
		} catch {
			// Non-fatal — the next real query will reconnect automatically.
		}
	}, 4 * 60 * 1000);
}
