import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/guard.ts';
import { audit } from '#lib/server/audit.ts';
import { str, commonPassword } from '#lib/server/forms.ts';
import {
	KEEP_MAX,
	backupDir,
	backupRunning,
	getAutoBackup,
	getAutoBackupStatus,
	nextRun,
	runAutoBackup,
	saveAutoBackup
} from '#lib/server/autoBackup.ts';
import { checkBackupPassword, createBackupKey } from '../../../../tools/backup-crypto.mjs';

/** La password dei backup protegge un file che chiunque lo trovi può provare ad aprire con calma: più lunga di quella degli account. */
const BACKUP_PASSWORD_MIN = 12;
/** Quanto aspetta il pulsante «Fai un backup adesso» prima di rispondere che il backup continua da solo. */
const RUN_WAIT = 20_000;

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals.user);
	const cfg = getAutoBackup();
	const st = getAutoBackupStatus();
	const now = Date.now();
	const { dir, custom } = backupDir();
	return {
		auto: { enabled: cfg.enabled, hour: cfg.hour, keep: cfg.keep, encrypted: !!cfg.key },
		status: st,
		running: backupRunning(),
		next: nextRun(cfg, st, now),
		dir,
		custom,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		keepMax: KEEP_MAX,
		passwordMin: BACKUP_PASSWORD_MIN
	};
};

const int = (f: FormData, k: string) => Number.parseInt(str(f, k, 4), 10);

export const actions: Actions = {
	auto: async ({ request, locals }) => {
		const me = requireAdmin(locals.user);
		const f = await request.formData();
		const enabled = f.get('enabled') === 'on';
		const hour = int(f, 'hour');
		const keep = int(f, 'keep');
		if (!(hour >= 0 && hour <= 23) || !(keep >= 1 && keep <= KEEP_MAX)) return fail(400, { error: 'errors.generic' });
		saveAutoBackup({ enabled, hour, keep });
		audit('settings_changed', { userId: me.id, ip: locals.ip }, `autoBackup=${enabled ? 'on' : 'off'} hour=${hour} keep=${keep}`);
		return { ok: 'common.saved' };
	},

	run: async ({ locals }) => {
		const me = requireAdmin(locals.user);
		const job = runAutoBackup({ userId: me.id, ip: locals.ip });
		const r = await Promise.race([job, new Promise<null>((ok) => setTimeout(() => ok(null), RUN_WAIT))]);
		if (!r) return { ok: 'backup.runStarted' };
		return r.ok ? { ok: 'backup.runDone' } : fail(500, { error: r.error ?? 'backup.errOther' });
	},

	encrypt: async ({ request, locals }) => {
		const me = requireAdmin(locals.user);
		const f = await request.formData();
		const password = String(f.get('password') ?? '');
		const confirm = String(f.get('confirm') ?? '');
		const fail400 = (error: string) => fail(400, { error, section: 'encrypt' });
		if (f.get('understood') !== 'on') return fail400('backup.errUnderstood');
		if (password.length < BACKUP_PASSWORD_MIN) return fail400('backup.errPasswordShort');
		if (password.length > 256) return fail400('errors.passwordLong');
		if (password !== confirm) return fail400('errors.passwordMismatch');
		if (commonPassword(password, me.username)) return fail400('errors.passwordCommon');
		const changed = !!getAutoBackup().key;
		saveAutoBackup({ key: await createBackupKey(password) });
		audit('settings_changed', { userId: me.id, ip: locals.ip }, `backupEncryption=${changed ? 'new-password' : 'on'}`);
		return { ok: changed ? 'backup.passwordChanged' : 'backup.encryptionOn' };
	},

	check: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const key = getAutoBackup().key;
		if (!key) return fail(400, { error: 'errors.generic' });
		const password = String((await request.formData()).get('password') ?? '');
		return (await checkBackupPassword(key, password)) ? { ok: 'backup.passwordRight' } : fail(400, { error: 'backup.passwordWrong', section: 'check' });
	},

	plain: async ({ request, locals }) => {
		const me = requireAdmin(locals.user);
		if ((await request.formData()).get('confirmPlain') !== 'on') return fail(400, { error: 'backup.errConfirmPlain', section: 'plain' });
		saveAutoBackup({ key: null });
		audit('settings_changed', { userId: me.id, ip: locals.ip }, 'backupEncryption=off');
		return { ok: 'backup.encryptionOff' };
	}
};
