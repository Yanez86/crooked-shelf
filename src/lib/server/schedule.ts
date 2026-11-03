import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { campaignId, currentCampaign, membersOf, ofCampaign } from './campaigns.ts';
import { ANSWERS, endsAt, lastOfMonth, localDate, occurrences, sessionStatus, shiftDay, starWishSession, type Answer } from '../schedule.ts';

const { appointments, appointmentAnswers, starWishes, users } = schema;

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
		db.delete(starWishes).where(and(eq(starWishes.appointmentId, id), eq(starWishes.date, date))).run();
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
export const monthSchedule = (month: string, now = Date.now()) => scheduleBetween(`${month}-01`, lastOfMonth(month), now);

/** Come monthSchedule, dal giorno `from` al giorno `to` compresi. */
function scheduleBetween(from: string, to: string, now: number) {
	const c = currentCampaign();
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

/**
 * Per la home: la prossima sessione che non salta (anche se è in corso) e le altre date del mese a cui il giocatore non ha ancora risposto.
 * ponytail: la prossima si cerca entro un anno, come per Stars & Wishes.
 */
export function upcoming(userId: number, now = Date.now()) {
	const today = localDate(new Date(now));
	// Da ieri: una sessione che passa la mezzanotte è ancora in corso.
	const items = scheduleBetween(shiftDay(today, -1), shiftDay(today, 366), now).filter((o) => endsAt(o.date, o.starts, o.ends) > now);
	const view = (o: (typeof items)[number]) => ({
		id: o.id,
		title: o.title,
		date: o.date,
		starts: o.starts,
		ends: o.ends,
		status: o.status,
		answer: ANSWERS.find((a) => o.answers[a].some((p) => p.id === userId)) ?? null
	});
	const next = items.find((o) => o.status !== 'cancelled');
	const end = lastOfMonth(today.slice(0, 7));
	return {
		next: next ? view(next) : null,
		toAnswer: items.filter((o) => o !== next && o.date <= end && o.answers.waiting.some((p) => p.id === userId)).map(view)
	};
}

/**
 * Stars & Wishes: la sessione su cui il giocatore può ancora rispondere, se c'era (aveva risposto «Ci sono») e non ha già risposto.
 * ponytail: si guarda un anno indietro e uno avanti; una sessione di più di un anno fa non chiede più niente.
 */
export function openStarWish(userId: number, now = Date.now()) {
	if (!currentCampaign().starWishes) return null;
	const today = localDate(new Date(now));
	const o = starWishSession(scheduleBetween(shiftDay(today, -366), shiftDay(today, 366), now), now);
	if (!o || ![...o.answers.in_person, ...o.answers.remote].some((p) => p.id === userId)) return null;
	const done = getDb()
		.select({ userId: starWishes.userId })
		.from(starWishes)
		.where(and(eq(starWishes.appointmentId, o.id), eq(starWishes.date, o.date), eq(starWishes.userId, userId)))
		.get();
	return done ? null : { id: o.id, title: o.title, date: o.date };
}

/** La risposta va sulla sessione aperta adesso per chi risponde, e una volta sola. */
export function saveStarWish(userId: number, star: string, wish: string, now = Date.now()): boolean {
	const o = openStarWish(userId, now);
	if (!o) return false;
	return getDb().insert(starWishes).values({ appointmentId: o.id, date: o.date, userId, star, wish, createdAt: now }).onConflictDoNothing().run().changes > 0;
}

/** Le risposte di Stars & Wishes del mese `YYYY-MM`, per data (`id/data`, come nel calendario). Le legge solo il Master. */
export function monthStarWishes(month: string) {
	const out: Record<string, { name: string; star: string; wish: string }[]> = {};
	for (const r of getDb()
		.select({ id: starWishes.appointmentId, date: starWishes.date, name: users.displayName, star: starWishes.star, wish: starWishes.wish })
		.from(starWishes)
		.innerJoin(appointments, eq(appointments.id, starWishes.appointmentId))
		.innerJoin(users, eq(users.id, starWishes.userId))
		.where(and(ofCampaign(appointments), gte(starWishes.date, `${month}-01`), lte(starWishes.date, lastOfMonth(month))))
		.orderBy(asc(users.displayName))
		.all())
		(out[`${r.id}/${r.date}`] ??= []).push({ name: r.name, star: r.star, wish: r.wish });
	return out;
}
