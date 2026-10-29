<script lang="ts">
	import { page as appPage } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import RelTime from '#lib/components/RelTime.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const locale = $derived(appPage.data.locale as string);
</script>

<svelte:head><title>{t('history.title', { title: data.page.title })}</title></svelte:head>

<p><a href="/wiki/{data.page.slug}">← {data.page.title}</a></p>
<h1>{t('history.title', { title: data.page.title })}</h1>
<FormError error={form?.error} />

{#if data.view}
	<section class="card shown" aria-labelledby="view-title">
		<h2 id="view-title">{t('history.viewing', { title: data.view.title })}</h2>
		<div class="prose">{@html data.view.html}</div>
	</section>
{/if}

{#if data.diff}
	<section class="card shown" aria-labelledby="diff-title">
		<h2 id="diff-title">{data.diff.prevId ? t('history.diffTitle') : t('history.firstVersion')}</h2>
		<p class="hint">{t('history.diffHint')}</p>
		<div class="diff">
			{#each data.diff.parts as p, i (i)}
				{#if p.type === 'add'}
					<ins><span class="visually-hidden">{t('history.added')}: </span>{p.text}</ins>
				{:else if p.type === 'del'}
					<del><span class="visually-hidden">{t('history.removed')}: </span>{p.text}</del>
				{:else}
					<span>{p.text}</span>
				{/if}
			{/each}
		</div>
	</section>
{/if}

<h2>{t('history.versions', { n: data.revisions.length })}</h2>
<ol class="list-plain revs">
	{#each data.revisions as r, i (r.id)}
		<li class="rev">
			<div>
				<strong><RelTime ts={r.createdAt} {locale} /></strong>
				<span class="muted">— {r.editor ?? '—'}</span>
				{#if r.id === data.latestId}<span class="badge">{t('history.current')}</span>{/if}
				{#if r.title !== data.page.title}<span class="muted"> · «{r.title}»</span>{/if}
			</div>
			<div class="acts">
				<a class="btn btn-small" href="?rev={r.id}">{t('history.view')}<span class="visually-hidden">: {t('history.versionN', { n: data.revisions.length - i })}</span></a>
				<a class="btn btn-small" href="?diff={r.id}">{t('history.compare')}<span class="visually-hidden">: {t('history.versionN', { n: data.revisions.length - i })}</span></a>
				{#if data.canRestore && r.id !== data.latestId}
					<form method="post" action="?/restore">
						<input type="hidden" name="id" value={r.id} />
						<button class="btn btn-small" type="submit">{t('history.restore')}<span class="visually-hidden">: {t('history.versionN', { n: data.revisions.length - i })}</span></button>
					</form>
				{/if}
			</div>
		</li>
	{/each}
</ol>

<style>
	.shown {
		margin-bottom: 2rem;
	}
	.shown h2 {
		margin-top: 0;
	}
	.diff {
		white-space: pre-wrap;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	ins {
		background: color-mix(in srgb, var(--c-success) 18%, var(--c-surface));
		text-decoration: underline;
		color: var(--c-text);
	}
	ins::before {
		content: '+ ';
		font-weight: 700;
		color: var(--c-success);
	}
	del {
		background: color-mix(in srgb, var(--c-danger) 15%, var(--c-surface));
		color: var(--c-text);
	}
	del::before {
		content: '− ';
		font-weight: 700;
		color: var(--c-danger);
	}
	.rev {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--c-border);
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
</style>
