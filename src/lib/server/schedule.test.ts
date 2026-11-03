import { beforeEach, describe, expect, it } from 'vitest';
import { schema, useMemoryDb } from './db/index.ts';
import { addMember, inCampaign, insertCampaign, removeMember, saveCampaign, type CampaignRow } from './campaigns.ts';
import { getAppointment, monthSchedule, monthStarWishes, openStarWish, saveAppointment, saveStarWish, setAnswer, skipDate, upcoming, type AppointmentInput } from './schedule.ts';

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

	it('Stars & Wishes: solo a chi è venuto, una risposta sola, finché il Master lo tiene acceso', () => {
		const a = here(() => saveAppointment(thursdays))!;
		here(() => setAnswer(a.id, '2026-11-05', 2, 'in_person'));
		here(() => setAnswer(a.id, '2026-11-05', 3, 'no'));
		const friday = new Date(2026, 10, 6, 12).getTime();
		// Spento: nessuna domanda.
		expect(here(() => openStarWish(2, friday))).toBeNull();
		saveCampaign(c.id, { starWishes: true });
		c = { ...c, starWishes: true };
		expect(here(() => openStarWish(2, friday))).toEqual({ id: a.id, title: 'Sessione', date: '2026-11-05' });
		// Bruno non c'era; il 12 è il giorno della sessione dopo.
		expect(here(() => openStarWish(3, friday))).toBeNull();
		expect(here(() => openStarWish(2, new Date(2026, 10, 12, 9).getTime()))).toBeNull();
		// Si risponde una volta: la seconda non passa e la prima resta com'è.
		expect(here(() => saveStarWish(2, 'Il drago', 'La torre', friday))).toBe(true);
		expect(here(() => saveStarWish(2, 'Altro', 'Altro', friday))).toBe(false);
		expect(here(() => openStarWish(2, friday))).toBeNull();
		expect(here(() => monthStarWishes('2026-11'))).toEqual({ [`${a.id}/2026-11-05`]: [{ name: 'Alice', star: 'Il drago', wish: 'La torre' }] });
		// Un'altra campagna non le vede.
		expect(inCampaign(other, () => monthStarWishes('2026-11'))).toEqual({});
	});

	it('in home: la prossima sessione e le date del mese ancora senza risposta', () => {
		const a = here(() => saveAppointment(thursdays))!;
		here(() => setAnswer(a.id, '2026-11-19', 2, 'no'));
		// Giovedì 12 alle 21: la sessione è in corso, ed è la prossima.
		const now = new Date(2026, 10, 12, 21).getTime();
		const u = here(() => upcoming(2, now));
		expect(u.next).toMatchObject({ date: '2026-11-12', answer: null });
		// Il 19 Alice ha già risposto; dicembre è un altro mese.
		expect(u.toAnswer.map((o) => o.date)).toEqual(['2026-11-26']);
		// Il Master non risponde: niente da chiedergli.
		expect(here(() => upcoming(1, now)).toAnswer).toEqual([]);
	});
});
