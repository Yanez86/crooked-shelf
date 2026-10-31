<script lang="ts">
	import Icon from './Icon.svelte';
	import { getT } from '../i18n/index.ts';
	import { PAGE_ICONS } from '../pageIcons.ts';
	import { COVER_COLORS, type PageCover } from '../covers.ts';

	/** La testa di una pagina: copertina, icona, titolo e matita. La stessa nelle pagine e nella home. */
	let {
		page,
		canEdit
	}: {
		page: { slug: string; title: string; icon: string | null; cover: PageCover | null };
		canEdit: boolean;
	} = $props();
	const t = getT();
</script>

{#if page.cover}
	{@const c = page.cover}
	<div class="page-cover" style:background-color={c.color ? COVER_COLORS[c.color] : null}>
		{#if c.image}<img src="/files/{c.image}" alt="" style:object-position="50% {c.y}%" />{/if}
	</div>
{/if}

<header class="page-head">
	{#if page.icon && PAGE_ICONS[page.icon]}
		<span class="page-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={PAGE_ICONS[page.icon]} /></svg></span>
	{/if}
	<h1>{page.title}</h1>
	{#if canEdit}
		<a class="edit-pencil" href="/wiki/{page.slug}/edit" title={t('page.edit')}><Icon name="edit" /><span class="visually-hidden">{t('page.edit')}: {page.title}</span></a>
	{/if}
</header>

<style>
	/* L'icona a sinistra del titolo, la matita sul bordo destro del testo. */
	.page-head {
		max-width: var(--measure);
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.page-head h1 {
		flex: 1;
		margin-bottom: 0.25rem;
	}
	/* Lo stesso margine del titolo: l'icona sta sulla sua prima riga. */
	.page-icon {
		margin-top: 0.5em;
	}
	.edit-pencil {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius);
		color: var(--c-muted);
		text-decoration: none;
		font-size: 1.1rem;
		opacity: 0.6;
		flex-shrink: 0;
	}
	.edit-pencil:hover,
	.edit-pencil:focus-visible {
		opacity: 1;
		color: var(--c-primary);
		background: var(--c-surface);
	}
</style>
