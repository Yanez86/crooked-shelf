import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { campaignId, currentCampaign, membersOf, ofCampaign } from './campaigns.ts';
import { ANSWERS, lastOfMonth, occurrences, sessionStatus, type Answer } from '../schedule.ts';

const { appointments, appointmentAnswers } = schema;

export type AppointmentRow = typeof appointments.$inferSelect;
export type AppointmentInput = Omit<AppointmentRow, 'id' | 'campaignId' | 'createdAt' | 'skips'>;

export const getAppointment = (id: number) =>
	getDb()
		.select()
		.from(appointments)
		.where(and(eq(appointments.id, id), ofCampaign(appointments)))
		.get();

export function saveAppointment(input: AppointmentInput, id?: number): AppointmentRow | undefined {
	const db = getDb();
	if (id) return db.update(appointments).set(input).where(and(eq(appointments.id, id), ofCampaign(appointments))).returning().get();
	return db
		.insert(appointments)
		.values({ ...input, campaignId: campaignId(), createdAt: Date.now() })
		.returning()
		.get();
}

export function deleteAppointment(id: number) {
	getDb().delete(appointments).where(and(eq(appointments.id, id), ofCampaign(appointments))).run();
}

/** Annulla una data della serie: le risposte per quella data se ne vanno con lei. */
export function skipDate(id: number, date: string) {
	const a = getAppointment(id);
	if (!a || !occurrences(a, date, date).length) return;
	const db = getDb();
	db.transaction(() => {
		db.update(appointments).set({ skips: [...a.skips, date] }).where(eq(appointments.id, id)).run();
		db.delete(appointmentAnswers).where(and(eq(appointmentAnswers.appointmentId, id), eq(appointmentAnswers.date, date))).run();
	});
}

/** La risposta di un giocatore: solo per una data che c'è davvero e per un modo che l'appuntamento ammette. */
export function setAnswer(id: number, date: string, userId: number, answer: Answer): boolean {
	const a = getAppointment(id);
	if (!a || !occurrences(a, date, date).length) return false;
	if ((answer === 'in_person' && !a.inPerson) || (answer === 'remote' && !a.remote)) return false;
	getDb()
		.insert(appointmentAnswers)
		.values({ appointmentId: id, date, userId, answer })
		.onConflictDoUpdate({ target: [appointmentAnswers.appointmentId, appointmentAnswers.date, appointmentAnswers.userId], set: { answer } })
		.run();
	return true;
}

type Player = ReturnType<typeof membersOf>[number];

/**
 * Le date del mese `YYYY-MM`, in ordine, con chi viene e come, chi no e chi non ha risposto.
 * Contano solo i giocatori che sono al tavolo adesso: chi è stato rimosso non sposta la regola del minimo.
 */
export function monthSchedule(month: string, now = Date.now()) {
	const c = currentCampaign();
	const from = `${month}-01`;
	const to = lastOfMonth(month);
	const db = getDb();
	const rows = db
		.select()
		.from(appointments)
		.where(and(ofCampaign(appointments), lte(appointments.date, to), or(isNull(appointments.until), gte(appointments.until, from))))
		.all();
	const players = membersOf(c.id);
	const given = new Map<string, Answer>();
	if (rows.length)
		for (const r of db
			.select()
			.from(appointmentAnswers)
			.where(and(inArray(appointmentAnswers.appointmentId, rows.map((a) => a.id)), gte(appointmentAnswers.date, from), lte(appointmentAnswers.date, to)))
			.all())
			given.set(`${r.appointmentId}/${r.date}/${r.userId}`, r.answer);

	return rows
		.flatMap((a) =>
			occurrences(a, from, to).map((date) => {
				const answers = Object.fromEntries([...ANSWERS, 'waiting'].map((k) => [k, [] as Player[]])) as Record<Answer | 'waiting', Player[]>;
				for (const p of players) answers[given.get(`${a.id}/${date}/${p.id}`) ?? 'waiting'].push(p);
				const going = answers.in_person.length + answers.remote.length;
				return {
					id: a.id,
					title: a.title,
					date,
					starts: a.starts,
					ends: a.ends,
					inPerson: a.inPerson,
					remote: a.remote,
					place: a.place,
					link: a.link ?? c.remoteLink,
					repeat: a.repeat,
					answers,
					status: sessionStatus(date, a.starts, going, { min: c.minPlayers, hours: c.quorumHours }, now)
				};
			})
		)
		.sort((x, y) => (x.date + x.starts).localeCompare(y.date + y.starts));
}
