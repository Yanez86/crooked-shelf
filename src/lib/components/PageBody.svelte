<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import { SIDE_COOKIE } from '../prefs.ts';
	import Icon from './Icon.svelte';

	type Field = { label: string; html: string; image?: { url: string; width: number; height: number } };

	/** Il corpo di una pagina: testo, e in alto a destra la colonna a lato. Lo stesso nella pagina e sopra la mappa. */
	let {
		title,
		html,
		fields,
		session,
		locale,
		head,
		more,
		foot,
		boxed = false
	}: {
		title: string;
		html: string;
		fields: Field[];
		session: { number: number | null; realDate: string | null; world: string | null } | null;
		locale: string;
		/** Quello che sta sopra il testo (titolo, matita…): così la colonna a lato parte dall'alto, accanto al titolo. */
		head?: Snippet;
		/** Altro da mettere nella colonna, sotto i riquadri (la home: le ultime pagine). */
		more?: Snippet;
		/** Quello che sta sotto il testo, nello stesso riquadro (mappa, collegamenti…). */
		foot?: Snippet;
		/** Il testo sta in un riquadro a sé (la descrizione sopra la mappa). */
		boxed?: boolean;
	} = $props();
	const t = getT();

	// Colonna a lato: le immagini da sole, i testi di seguito nella stessa scheda (con i dati della sessione in cima).
	const groups = $derived(
		fields.reduce<(Field | Field[])[]>(
			(out, f) => {
				const last = out.at(-1);
				if (f.image) out.push(f);
				else if (Array.isArray(last)) last.push(f);
				else out.push([f]);
				return out;
			},
			session ? [[]] : []
		)
	);
	const hasSide = $derived(groups.length > 0 || !!more);

	// La freccia nasconde la colonna, in tutte le pagine di questo browser. Il cookie si rilegge qui perché i dati del layout
	// non si ricaricano cambiando pagina. Sopra la mappa (senza `head`) la colonna non si nasconde.
	const foldable = $derived(hasSide && !!head);
	let sideHidden = $state(typeof document === 'undefined' ? !!page.data.sideHidden : document.cookie.split('; ').includes(`${SIDE_COOKIE}=1`));

	// Il fuoco passa alla freccia opposta: quella appena premuta non c'è più.
	async function hideSide(hidden: boolean) {
		sideHidden = hidden;
		document.cookie = `${SIDE_COOKIE}=${hidden ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
		await tick();
		document.getElementById(hidden ? 'side-show' : 'side-hide')?.focus();
	}
</script>

<!-- Senza riquadri la colonna non c'è: si aggiunge modificando la pagina. -->
<div class="body" class:with-side={hasSide} class:side-hidden={foldable && sideHidden} class:headed={head}>
	{#if hasSide}
		{#if foldable && sideHidden}
			<button id="side-show" class="btn side-show" type="button" title={t('fields.show')} aria-label={t('fields.show')} onclick={() => hideSide(false)}>
				<Icon name="arrowLeft" />
			</button>
		{/if}
		<div class="side-col">
			{#if foldable}
				<button type="button" id="side-hide" class="side-hide" title={t('fields.hide')} aria-label={t('fields.hide')} onclick={() => hideSide(true)}>
					<Icon name="arrowRight" />
				</button>
			{/if}
			{#if groups.length}
				<aside class="side panel" aria-label={t('fields.title')}>
					{#each groups as g, i (i)}
						{#if Array.isArray(g)}
							<dl>
								{#if i === 0 && session}
									{#if session.number}<dt>{t('session.number')}</dt><dd>{session.number}</dd>{/if}
									{#if session.realDate}
										<dt>{t('session.realDate')}</dt>
										<dd><time datetime={session.realDate}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(session.realDate + 'T12:00:00'))}</time></dd>
									{/if}
									{#if session.world}<dt>{t('session.worldDate')}</dt><dd>{session.world}</dd>{/if}
								{/if}
								{#each g as f, j (j)}
									<dt>{f.label}</dt>
									<dd>{@html f.html || '—'}</dd>
								{/each}
							</dl>
						{:else if g.image}
							<figure>
								<img src={g.image.url} alt={g.label || title} width={g.image.width} height={g.image.height} />
								{#if g.label}<figcaption>{g.label}</figcaption>{/if}
							</figure>
						{/if}
					{/each}
				</aside>
			{/if}
			{@render more?.()}
		</div>
	{/if}

	<div class="content" class:panel={hasSide}>
		{#if head}<div class="head">{@render head()}</div>{/if}
		<div class="prose" class:panel={boxed}>
			{#if html}
				{@html html}
			{:else}
				<p class="muted">{t('page.empty')}</p>
			{/if}
		</div>
		{#if foot}<div class="foot">{@render foot()}</div>{/if}
	</div>
</div>

<style>
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-items: start;
		gap: 1.5rem 2rem;
		margin: 1.5rem 0 2.5rem;
	}
	.body.with-side {
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.body.headed {
		margin-top: 0;
	}
	.body:last-child {
		margin-bottom: 0;
	}
	.headed .prose {
		margin-top: 1.5rem;
	}
	.content {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
	}
	.prose.panel > :global(:last-child) {
		margin-bottom: 0;
	}
	.foot {
		min-width: 0;
		margin-top: 2.5rem;
	}
	/* La colonna in alto a destra: un riquadro a sé, staccato dal testo. */
	.side-col {
		position: relative;
		grid-column: 2;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: var(--side-col);
		max-width: 100%;
	}
	/* Colonna nascosta con la freccia: al suo posto resta solo la freccia per riaprirla, come nella barra a sinistra. */
	.side-hidden {
		column-gap: 1rem;
	}
	.side-hidden .side-col {
		display: none;
	}
	.side-show {
		position: sticky;
		top: 1rem;
		grid-column: 2;
		grid-row: 1;
		align-self: start;
		padding: 0;
	}
	/* Dentro il riquadro, dal lato del testo: lo specchio della freccia della barra a sinistra. */
	.side-hide {
		position: absolute;
		top: calc(4px + 0.35rem);
		left: 0.35rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		cursor: pointer;
	}
	.side-hide:hover {
		background: var(--c-surface2);
		color: var(--c-text);
	}
	.side-hide :global(.icon) {
		width: 1.15rem;
		height: 1.15rem;
	}
	.side-hide + :global(*) {
		padding-top: 2.6rem;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.side > * + * {
		border-top: 1px solid var(--c-border);
		padding-top: 1rem;
	}
	figure {
		margin: 0;
	}
	figure img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 28rem;
		object-fit: contain;
		background: var(--c-surface2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
	}
	figcaption {
		margin-top: 0.4rem;
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	/* Nello spazio stretto (telefono) la colonna va in cima, prima del testo. */
	@container (max-width: 44rem) {
		.body.with-side {
			grid-template-columns: minmax(0, 1fr);
		}
		.side-col {
			grid-column: 1;
			width: auto;
		}
		/* Qui la colonna sta nel flusso del testo: niente frecce, e si vede anche se altrove è nascosta. */
		.side-hidden .side-col {
			display: flex;
		}
		.side-show,
		.side-hide {
			display: none;
		}
		.side-hide + :global(*) {
			padding-top: 1rem;
		}
		figure img {
			max-width: 22rem;
		}
		.content {
			grid-row: 2;
		}
		/* Il titolo resta in cima: titolo, colonna, testo. */
		.headed .content {
			display: contents;
		}
		.head {
			grid-row: 1;
		}
		.headed .side-col {
			grid-row: 2;
		}
		.headed .prose {
			grid-row: 3;
			min-width: 0;
			margin-top: 0;
		}
		.foot {
			grid-row: 4;
		}
	}
	/* Titolo su tutta la larghezza, il testo a capo sotto. */
	.side dl {
		margin: 0;
	}
	.side dt {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.side dd {
		margin: 0 0 0.6rem;
		overflow-wrap: anywhere;
	}
	.side dd:last-child {
		margin-bottom: 0;
	}
</style>
