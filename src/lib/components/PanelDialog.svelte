<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';

	/**
	 * Profilo, Amministrazione e pagine collegate in sovraimpressione sulla wiki, che resta sotto così com'è. Si chiude con Esc, con la X o cliccando fuori.
	 * Con `expandable` la pagina ha già il suo titolo: nella barra restano i pulsanti, e uno porta ciò che è aperto nel popup sulla schermata principale.
	 */
	// ponytail: un iframe delle pagine vere, così moduli, file e sezioni funzionano senza doppioni.
	// L'indirizzo non cambia e Indietro non lo chiude: per averli servono lo shallow routing e i moduli rifatti.
	let { href, title, onclose, expandable = false }: { href: string; title: string; onclose: () => void; expandable?: boolean } = $props();
	const t = getT();
	let dlg = $state<HTMLDialogElement>();
	let frame = $state<HTMLIFrameElement>();
	let saved = false;

	$effect(() => dlg?.showModal());

	// Dentro il popup si naviga: conta la pagina aperta adesso, non quella di partenza.
	function expand() {
		const { pathname, search, hash } = frame!.contentWindow!.location;
		dlg?.close();
		goto(pathname + search + hash);
	}

	// Il fuoco sta dentro l'iframe: Esc e i salvataggi vanno ascoltati lì.
	function listen(e: Event) {
		const win = (e.currentTarget as HTMLIFrameElement).contentWindow;
		win?.addEventListener('keydown', (k: KeyboardEvent) => k.key === 'Escape' && dlg?.close());
		win?.addEventListener('submit', () => (saved = true));
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<dialog
	bind:this={dlg}
	aria-labelledby="panel-title"
	onclick={(e) => e.target === dlg && dlg.close()}
	onclose={() => {
		onclose();
		// Nome, icona e tema scelti nel popup valgono anche per la wiki qui sotto. Solo dopo un salvataggio:
		// ricaricare i dati rimette i valori iniziali nei campi della pagina che si sta scrivendo sotto il popup.
		if (saved) invalidate('app:layout');
	}}
>
	<header class="bar">
		<h1 id="panel-title" class:visually-hidden={expandable}>{title}</h1>
		<div class="tools">
			{#if expandable}
				<button class="btn btn-small btn-ghost" type="button" title={t('maps.fullPage')} aria-label={t('maps.fullPage')} onclick={expand}><Icon name="fullscreen" /></button>
			{/if}
			<button class="btn btn-small btn-ghost" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={() => dlg?.close()}><Icon name="close" /></button>
		</div>
	</header>
	<iframe bind:this={frame} src={href} {title} onload={listen}></iframe>
</dialog>

<style>
	dialog {
		width: min(100% - 2rem, 70rem);
		height: calc(100dvh - 2rem);
		max-width: none;
		max-height: none;
		padding: 0;
		overflow: hidden;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
	}
	dialog[open] {
		display: flex;
		flex-direction: column;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--c-border);
	}
	.bar h1 {
		margin: 0;
		font-size: var(--fs-xl);
	}
	.tools {
		display: flex;
		gap: 0.25rem;
		margin-left: auto;
	}
	iframe {
		flex: 1;
		min-height: 0;
		width: 100%;
		border: 0;
	}
	/* Sul telefono la finestra prende tutto lo schermo. */
	@media (max-width: 40rem) {
		dialog {
			width: 100%;
			height: 100dvh;
			margin: 0;
			border: 0;
		}
	}
</style>
