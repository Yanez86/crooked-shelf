<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import PageForm from '#lib/components/PageForm.svelte';
	import KindSettings from '#lib/components/KindSettings.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import { EMPTY_DOC, isDoc, type DocNode } from '#lib/content/types.ts';
	import { PAGE_ICONS } from '#lib/pageIcons.ts';
	import { KIND_ICONS, type PageKind } from '#lib/pageKinds.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();

	const values = $derived(
		form?.values
			? { ...form.values, kind: form.values.kind as PageKind, content: isDoc(form.values.content) ? form.values.content : EMPTY_DOC }
			: {
					title: data.title,
					slug: data.slug,
					content: (data.start?.content ?? EMPTY_DOC) as DocNode,
					visibility: data.kind === 'timeline' ? 'public' : 'players',
					playersCanEdit: false,
					categoryId: data.categoryId,
					tags: '',
					fields: data.start?.fields ?? [],
					template: data.start?.template ?? null,
					session: data.start?.session ?? null,
					icon: data.start?.icon ?? null,
					kind: data.kind as PageKind
				}
	);
	const extra = $derived(form?.extra ?? { map: { parentId: data.parentId, across: '', unit: '' }, mode: 'world', columns: undefined as string | undefined });
	const kind = $derived(values.kind);

	/** Collegamento al modulo scelto, mantenendo titolo, indirizzo e categoria. */
	function start(key: string, value: string) {
		const u = new URL(page.url.href);
		u.searchParams.delete('template');
		u.searchParams.delete('kind');
		u.searchParams.set(key, value);
		return u.pathname + u.search;
	}

	const heading = $derived(
		data.start ? t('page.newFromTemplate', { name: data.start.title }) : kind === 'page' ? t('page.newTitle') : t('kinds.new.' + kind)
	);
</script>

<svelte:head><title>{heading}</title></svelte:head>

{#snippet icon(d: string)}
	<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path {d} /></svg>
{/snippet}

{#if !data.chosen}
	<h1>{t('page.newTitle')}</h1>
	<p>{t('kinds.choose')}</p>
	<!-- Prima i tipi di pagina (vuota, bacheca, cronologia…), poi le fotocopie dei template. -->
	<ul class="list-plain template-grid">
		<li>
			<a class="card template-card" href={start('template', 'none')}>
				<strong>{@render icon('M6 2.75h8.25L19 7.5v13.75H6zM14 2.75V7.5h5')}{t('templates.blank')}</strong>
				<span class="muted">{t('templates.blankHint')}</span>
			</a>
		</li>
		{#each data.otherKinds as k (k)}
			<li>
				<a class="card template-card" href={start('kind', k)}>
					<strong>{@render icon(KIND_ICONS[k])}{t('kinds.new.' + k)}</strong>
					<span class="muted">{t('kinds.hint.' + k)}</span>
				</a>
			</li>
		{/each}
	</ul>
	{#if data.templates.length}
		<h2>{t('kinds.fromTemplate')}</h2>
		<ul class="list-plain template-grid">
			{#each data.templates as tp (tp.slug)}
				<li>
					<a class="card template-card" href={start('template', tp.slug)}>
						<strong>{@render icon(PAGE_ICONS[tp.icon ?? ''] ?? KIND_ICONS.template)}{tp.title}</strong>
						<span class="muted">
							{#if tp.session}{t('templates.isSession')}{:else if tp.fields.length}{tp.fields.join(', ')}{:else}{t('kinds.template')}{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	<h1 class="visually-hidden">{heading}</h1>
	<FormError error={form?.error} />
	{#key form}
		<PageForm
			{values}
			categories={data.categories}
			visibilities={data.visibilities}
			canManage={true}
			canSecret={data.canSecret}
			canTemplate={data.canTemplate}
			knownTags={data.knownTags}
			months={data.months}
			multipart={kind === 'map'}
			submitLabel={kind === 'map' ? t('maps.create') : t('page.create')}
			cancelHref="/wiki"
			settings={kind === 'map' || kind === 'timeline' || kind === 'board' ? settings : undefined}
		/>
	{/key}
{/if}

{#snippet settings()}
	{#if kind === 'map' || kind === 'timeline' || kind === 'board'}
		<KindSettings {kind} map={extra.map} mode={extra.mode} columns={extra.columns} parents={data.parents} requireImage={true} />
	{/if}
{/snippet}

<style>
	h2 {
		font-size: var(--fs-md);
		margin: 1.75rem 0 0.5rem;
	}
	.template-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.75rem;
	}
	.template-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		height: 100%;
		color: var(--c-text);
		text-decoration: none;
		border-width: 2px;
	}
	.template-card strong {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--c-link);
		font-size: var(--fs-md);
		text-decoration: underline;
	}
	.template-card:hover {
		border-color: var(--c-primary);
	}
	.ico {
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
