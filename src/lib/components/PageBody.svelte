<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import PageImage from './PageImage.svelte';

	/** Il corpo di una pagina: testo, e in alto a destra immagine e scheda. Lo stesso nella pagina e sopra la mappa. */
	let {
		title,
		image,
		html,
		fields,
		session,
		locale,
		canEdit = false,
		imageError = null,
		imageOk = null
	}: {
		title: string;
		image: { url: string; width: number; height: number } | null;
		html: string;
		fields: { label: string; html: string }[];
		session: { number: number | null; realDate: string | null; world: string | null } | null;
		locale: string;
		canEdit?: boolean;
		imageError?: string | null;
		imageOk?: string | null;
	} = $props();
	const t = getT();
</script>

<div class="body">
	<div class="side">
		<PageImage {image} {title} {canEdit} error={imageError} ok={imageOk} />
		{#if fields.length || session}
			<aside class="infobox" aria-label={t('fields.title')}>
				<dl>
					{#if session}
						{#if session.number}<dt>{t('session.number')}</dt><dd>{session.number}</dd>{/if}
						{#if session.realDate}
							<dt>{t('session.realDate')}</dt>
							<dd><time datetime={session.realDate}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(session.realDate + 'T12:00:00'))}</time></dd>
						{/if}
						{#if session.world}<dt>{t('session.worldDate')}</dt><dd>{session.world}</dd>{/if}
					{/if}
					{#each fields as f, i (i)}
						<dt>{f.label}</dt>
						<dd>{@html f.html || '—'}</dd>
					{/each}
				</dl>
			</aside>
		{/if}
	</div>

	<div class="prose content">
		{#if html}
			{@html html}
		{:else}
			<p class="muted">{t('page.empty')}</p>
		{/if}
	</div>
</div>

<style>
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: 1.5rem 2rem;
		margin: 1.5rem 0 2.5rem;
	}
	.content {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
	}
	/* Immagine e scheda in alto a destra. */
	.side {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 100%;
	}
	/* Senza immagine né scheda resta solo il pulsante: la colonna non ruba spazio al testo. */
	/* Con immagine o scheda la colonna diventa un riquadro a sé, staccato dal testo. */
	.side:has(:global(.page-image:not(.bare)), .infobox) {
		width: 20rem;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
		padding: 1rem;
	}
	.infobox:not(:first-child) {
		border-top: 1px solid var(--c-border);
		padding-top: 1rem;
	}
	/* Nello spazio stretto (telefono) immagine e scheda vanno in cima, prima del testo. */
	@container (max-width: 44rem) {
		.body {
			grid-template-columns: minmax(0, 1fr);
		}
		.side,
		.side:has(:global(.page-image:not(.bare)), .infobox) {
			grid-column: 1;
			width: auto;
		}
		.side > :global(.page-image) {
			max-width: 22rem;
		}
		.content {
			grid-row: 2;
		}
	}
	.infobox dl {
		margin: 0;
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		gap: 0.4rem 0.75rem;
	}
	.infobox dt {
		font-weight: 700;
	}
	.infobox dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
