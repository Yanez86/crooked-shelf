<script lang="ts">
	import { getT } from '../i18n/index.ts';

	type Field = { label: string; html: string; image?: { url: string; width: number; height: number } };

	/** Il corpo di una pagina: testo, e in alto a destra la colonna a lato. Lo stesso nella pagina e sopra la mappa. */
	let {
		title,
		html,
		fields,
		session,
		locale
	}: {
		title: string;
		html: string;
		fields: Field[];
		session: { number: number | null; realDate: string | null; world: string | null } | null;
		locale: string;
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
</script>

<!-- Senza riquadri la colonna non c'è: si aggiunge modificando la pagina. -->
<div class="body" class:with-side={groups.length > 0}>
	{#if groups.length}
		<aside class="side" aria-label={t('fields.title')}>
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
		grid-template-columns: minmax(0, 1fr);
		align-items: start;
		gap: 1.5rem 2rem;
		margin: 1.5rem 0 2.5rem;
	}
	.body.with-side {
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.content {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
	}
	/* La colonna in alto a destra: un riquadro a sé, staccato dal testo. */
	.side {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 20rem;
		max-width: 100%;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
		padding: 1rem;
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
		.side {
			grid-column: 1;
			width: auto;
		}
		figure img {
			max-width: 22rem;
		}
		.content {
			grid-row: 2;
		}
	}
	.side dl {
		margin: 0;
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		gap: 0.4rem 0.75rem;
	}
	.side dt {
		font-weight: 700;
	}
	.side dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
