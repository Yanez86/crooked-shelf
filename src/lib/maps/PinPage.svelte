<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import PageBody from '../components/PageBody.svelte';
	import RulePopover from '../components/RulePopover.svelte';
	import LinkPreview from '../components/LinkPreview.svelte';
	import type { ViewPin } from './MapView.svelte';

	/** La pagina collegata a un pin, in sovraimpressione sulla mappa. Si chiude con Esc, con Chiudi o cliccando fuori. */
	let { editable = false, onedit }: { editable?: boolean; onedit?: (id: number) => void } = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);

	interface View {
		slug: string;
		title: string;
		image: { url: string; width: number; height: number } | null;
		html: string;
		fields: { label: string; html: string }[];
		session: { number: number | null; realDate: string | null; world: string | null } | null;
	}

	let dlg: HTMLDialogElement | undefined = $state();
	let pin = $state<ViewPin | null>(null);
	let view = $state<View | null>(null);
	let failed = $state(false);
	// Le pagine già aperte da questa mappa non si scaricano di nuovo.
	const cache = new Map<string, View>();

	export async function show(p: ViewPin) {
		if (!p.page || !dlg) return;
		const slug = p.page.slug;
		pin = p;
		failed = false;
		view = cache.get(slug) ?? null;
		if (!dlg.open) dlg.showModal();
		dlg.scrollTop = 0;
		// Il fuoco sulla finestra: il lettore di schermo legge il titolo, le frecce la fanno scorrere.
		dlg.focus();
		if (view) return;
		const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`).catch(() => null);
		const data: View | null = res?.ok ? await res.json().catch(() => null) : null;
		// Nel frattempo si è chiusa, o si è aperto un altro pin.
		if (pin?.page?.slug !== slug) return;
		if (data) cache.set(slug, data);
		view = data;
		failed = !data;
	}

	function edit(id: number) {
		dlg?.close();
		onedit?.(id);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dlg}
	class="pin-page"
	aria-labelledby="pin-page-title"
	tabindex="-1"
	onclick={(e) => {
		// Clic sullo sfondo, fuori dalla finestra: chiude. (Anche la barra di scorrimento è la finestra stessa.)
		const r = dlg!.getBoundingClientRect();
		if (e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dlg!.close();
	}}
	onclose={() => {
		pin = null;
		view = null;
	}}
>
	{#if pin?.page}
		<header class="bar">
			<h1 id="pin-page-title">{view?.title ?? pin.page.title}</h1>
			<div class="acts">
				<a class="btn btn-small" href="/wiki/{pin.page.slug}">{t('maps.fullPage')}</a>
				<button class="btn btn-small" type="button" onclick={() => dlg?.close()}>✕ {t('common.close')}</button>
			</div>
		</header>

		{#if pin.html || pin.target || editable}
			<div class="pin-info">
				{#if pin.html}<p>{@html pin.html}</p>{/if}
				{#if pin.target}<p><a href="/maps/{pin.target.slug}">{t('maps.openMap', { title: pin.target.title })}</a></p>{/if}
				{#if editable}<p><button class="btn btn-small btn-ghost" type="button" onclick={() => edit(pin!.id)}>{t('maps.editPin')}</button></p>{/if}
			</div>
		{/if}

		<div class="page" aria-busy={!view && !failed}>
			{#if view}
				<PageBody title={view.title} image={view.image} html={view.html} fields={view.fields} session={view.session} {locale} />
			{:else if failed}
				<p role="alert">{t('maps.pageError')}</p>
			{:else}
				<p class="muted">{t('maps.pageLoading')}</p>
			{/if}
		</div>
	{/if}

	<RulePopover within={dlg} />
	<LinkPreview within={dlg} />
</dialog>

<style>
	.pin-page {
		width: min(100% - 2rem, 64rem);
		max-width: none;
		max-height: calc(100dvh - 2rem);
		padding: 0;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
		overscroll-behavior: contain;
	}
	.pin-page::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	.pin-page:focus {
		outline: none;
	}
	/* Titolo e pulsanti restano in vista mentre la pagina scorre. */
	.bar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding: 0.75rem 1.25rem;
		background: var(--c-bg);
		border-bottom: 1px solid var(--c-border);
	}
	.bar h1 {
		margin: 0;
		font-size: var(--fs-xl);
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.pin-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 1.25rem;
		padding: 0.5rem 1.25rem 0;
		font-size: var(--fs-sm);
	}
	.pin-info p {
		margin: 0.25rem 0;
	}
	.page {
		padding: 0 1.25rem;
		/* Immagine e scheda si mettono sopra il testo quando la finestra è stretta. */
		container-type: inline-size;
	}
	.page > p {
		margin: 1.5rem 0;
	}
	/* Sul telefono la finestra prende tutto lo schermo. */
	@media (max-width: 40rem) {
		.pin-page {
			width: 100%;
			height: 100dvh;
			max-height: none;
			margin: 0;
			border: 0;
			border-radius: 0;
		}
	}
</style>
