<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';
	import FormError from './FormError.svelte';

	/**
	 * Stars & Wishes: le due domande sull'ultima sessione, alla prima pagina aperta dopo la sessione (vedi +layout.server.ts).
	 * «Più tardi», Esc o la X le rimandano di qualche ora. La sessione la sceglie il server anche all'invio.
	 */
	let { session }: { session: { title: string; date: string } } = $props();
	const t = getT();
	let dlg = $state<HTMLDialogElement>();
	let closeBtn = $state<HTMLButtonElement>();
	let error = $state<string | null>(null);
	let done = $state(false);

	$effect(() => dlg?.showModal());
	// Il pulsante premuto sparisce col modulo: il fuoco va sul pulsante che chiude.
	$effect(() => {
		if (done) closeBtn?.focus();
	});

	// Data "di parete", come negli Appuntamenti: in UTC, così il fuso di chi guarda non sposta il giorno.
	const day = $derived(
		new Intl.DateTimeFormat(page.data.locale as string, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(session.date + 'T00:00:00Z'))
	);
</script>

<dialog bind:this={dlg} aria-labelledby="sw-title" aria-describedby="sw-intro">
	<h2 id="sw-title">{t('schedule.starWishes.title')}</h2>
	{#if done}
		<p id="sw-intro" role="status">{t('schedule.starWishes.thanks')}</p>
		<div class="actions">
			<button bind:this={closeBtn} class="btn btn-primary" type="button" onclick={() => dlg?.close()}>{t('common.close')}</button>
		</div>
	{:else}
		<p id="sw-intro">{t('schedule.starWishes.intro', { title: session.title, date: day })}</p>
		<form
			method="post"
			action="/schedule?/starWish"
			use:enhance={() =>
				async ({ result }) => {
					if (result.type === 'success') done = true;
					else error = result.type === 'failure' ? String(result.data?.starWishError ?? 'errors.generic') : 'errors.generic';
				}}
		>
			<FormError {error} />
			<div class="field">
				<label for="sw-star">{t('schedule.starWishes.star')}</label>
				<textarea id="sw-star" name="star" rows="3" maxlength="2000"></textarea>
			</div>
			<div class="field">
				<label for="sw-wish">{t('schedule.starWishes.wish')}</label>
				<textarea id="sw-wish" name="wish" rows="3" maxlength="2000"></textarea>
			</div>
			<p id="sw-final" class="hint">{t('schedule.starWishes.final')}</p>
			<div class="actions">
				<button class="btn btn-primary" type="submit" aria-describedby="sw-final"><Icon name="check" />{t('schedule.starWishes.send')}</button>
				<button class="btn" type="button" onclick={() => dlg?.close()}>{t('schedule.starWishes.later')}</button>
			</div>
		</form>
	{/if}
	<!-- In fondo al codice, in alto a destra a schermo: così il fuoco parte dal primo campo. -->
	<button class="btn btn-small btn-ghost close" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={() => dlg?.close()}><Icon name="close" /></button>
</dialog>

<style>
	dialog {
		width: min(100% - 2rem, 34rem);
		max-width: none;
		padding: 1.25rem;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	h2 {
		margin-top: 0;
		padding-right: 2.75rem;
	}
	textarea {
		width: 100%;
	}
	.close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0;
	}
</style>
