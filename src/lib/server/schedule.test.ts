import { beforeEach, describe, expect, it } from 'vitest';
import { schema, useMemoryDb } from './db/index.ts';
import { addMember, inCampaign, insertCampaign, removeMember, saveCampaign, type CampaignRow } from './campaigns.ts';
import { getAppointment, monthSchedule, saveAppointment, setAnswer, skipDate, type AppointmentInput } from './schedule.ts';

const thursdays: AppointmentInput = { title: 'Sessione', date: '2026-11-05', starts: '20:00', ends: '00:00', inPerson: true, remote: false, place: 'Da Marco', link: null, repeat: 'week', until: null };
const names = ['Davide', 'Alice', 'Bruno', 'Carla'];

let c: CampaignRow;
let other: CampaignRow;
const here = <T>(fn: () => T) => inCampaign(c, fn);

beforeEach(() => {
	const db = useMemoryDb();
	names.forEach((n, i) => db.insert(schema.users).values({ id: i + 1, role: i ? 'player' : 'master', username: n.toLowerCase(), displayName: n, passwordHash: 'x', createdAt: 0 }).run());
	c = insertCampaign('Ombre', 1);
	other = insertCampaign('Altra', 1);
	addMember(c.id, 2);
	addMember(c.id, 3);
});

describe('appuntamenti nel server', () => {
	it('le risposte: solo per date vere e modi ammessi', () => {
		const a = here(() => saveAppointment(thursdays))!;
		expect(here(() => setAnswer(a.id, '2026-11-12', 2, 'in_person'))).toBe(true);
		// Un venerdì non è una data della serie; il remoto non è ammesso.
		expect(here(() => setAnswer(a.id, '2026-11-13', 2, 'in_person'))).toBe(false);
		expect(here(() => setAnswer(a.id, '2026-11-12', 3, 'remote'))).toBe(false);
		// Da un'altra campagna l'appuntamento non si trova.
		expect(inCampaign(other, () => setAnswer(a.id, '2026-11-12', 2, 'no'))).toBe(false);
		expect(inCampaign(other, () => getAppointment(a.id))).toBeUndefined();
		// Si cambia idea.
		here(() => setAnswer(a.id, '2026-11-12', 2, 'no'));
		const o = here(() => monthSchedule('2026-11')).find((x) => x.date === '2026-11-12')!;
		expect(o.answers.no.map((p) => p.displayName)).toEqual(['Alice']);
		expect(o.answers.waiting.map((p) => p.displayName)).toEqual(['Bruno']);
	});

	it('la regola del minimo conta solo chi è al tavolo', () => {
		saveCampaign(c.id, { minPlayers: 2, remoteLink: 'https://discord.gg/ombre' });
		c = { ...c, minPlayers: 2, remoteLink: 'https://discord.gg/ombre' };
		const a = here(() => saveAppointment({ ...thursdays, remote: true }))!;
		here(() => setAnswer(a.id, '2026-11-26', 2, 'in_person'));
		here(() => setAnswer(a.id, '2026-11-26', 3, 'remote'));
		const now = new Date(2026, 10, 3).getTime();
		const at = () => here(() => monthSchedule('2026-11', now)).find((x) => x.date === '2026-11-26')!;
		expect(at().status).toBe('confirmed');
		expect(at().link).toBe('https://discord.gg/ombre');
		removeMember(c.id, 3);
		expect(at().status).toBe('pending');
		expect(at().answers.remote).toEqual([]);
	});

	it('una data annullata sparisce, con le sue risposte', () => {
		const a = here(() => saveAppointment(thursdays))!;
		here(() => setAnswer(a.id, '2026-11-19', 2, 'in_person'));
		here(() => skipDate(a.id, '2026-11-19'));
		expect(here(() => monthSchedule('2026-11')).map((o) => o.date)).toEqual(['2026-11-05', '2026-11-12', '2026-11-26']);
		expect(here(() => setAnswer(a.id, '2026-11-19', 2, 'in_person'))).toBe(false);
		// Il mese di un'altra campagna è vuoto.
		expect(inCampaign(other, () => monthSchedule('2026-11'))).toEqual([]);
	});
});
