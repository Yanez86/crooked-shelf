<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('nav.categories')} · {page.data.siteName}</title></svelte:head>

<h1>{t('nav.categories')}</h1>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={form && 'ok' in form ? form.ok : null} />

{#if data.categories.length}
	<ul class="tree">
		{#each data.categories as c (c.id)}
			<li style="--depth: {c.depth}">
				<a href="/wiki?category={encodeURIComponent(c.slug)}">{c.name}</a>
				<span class="muted">({t('categories.pages', { n: c.count })})</span>
				{#if c.description}<span class="muted desc">— {c.description}</span>{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">{t('categories.empty')}</p>
{/if}

{#if data.canManage}
	<section aria-labelledby="new-cat">
		<h2 id="new-cat">{t('categories.new')}</h2>
		<form method="post" action="?/create" class="card inline-form">
			<div class="field">
				<label for="new-name">{t('common.name')}</label>
				<input id="new-name" name="name" type="text" required maxlength="80" />
			</div>
			<div class="field">
				<label for="new-parent">{t('categories.parent')}</label>
				<select id="new-parent" name="parentId">
					<option value="">{t('categories.root')}</option>
					{#each data.categories as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
				</select>
			</div>
			<div class="field wide">
				<label for="new-desc">{t('common.description')}</label>
				<input id="new-desc" name="description" type="text" maxlength="500" />
			</div>
			<div class="field"><button class="btn btn-primary" type="submit">{t('categories.add')}</button></div>
		</form>
	</section>

	{#if data.categories.length}
		<section aria-labelledby="edit-cat">
			<h2 id="edit-cat">{t('categories.manage')}</h2>
			{#each data.categories as c (c.id)}
				<details class="card cat-edit">
					<summary>{c.name}</summary>
					<form method="post" action="?/update" class="inline-form">
						<input type="hidden" name="id" value={c.id} />
						<div class="field">
							<label for="name-{c.id}">{t('common.name')}</label>
							<input id="name-{c.id}" name="name" type="text" required maxlength="80" value={c.name} />
						</div>
						<div class="field">
							<label for="parent-{c.id}">{t('categories.parent')}</label>
							<select id="parent-{c.id}" name="parentId">
								<option value="">{t('categories.root')}</option>
								{#each data.categories.filter((o) => o.id !== c.id) as o (o.id)}
									<option value={o.id} selected={c.parentId === o.id}>{o.label}</option>
								{/each}
							</select>
						</div>
						<div class="field wide">
							<label for="desc-{c.id}">{t('common.description')}</label>
							<input id="desc-{c.id}" name="description" type="text" maxlength="500" value={c.description} />
						</div>
						<div class="field"><button class="btn" type="submit"><Icon name="save" />{t('common.save')}</button></div>
					</form>
					<form method="post" action="?/delete">
						<input type="hidden" name="id" value={c.id} />
						<button class="btn btn-danger btn-small" type="submit">{t('common.delete')}<span class="visually-hidden">: {c.name}</span></button>
						<span class="hint">{t('categories.deleteHint')}</span>
					</form>
				</details>
			{/each}
		</section>
	{/if}
{/if}

<style>
	.tree {
		list-style: none;
		padding: 0;
	}
	.tree li {
		padding: 0.3rem 0 0.3rem calc(var(--depth) * 1.5rem);
	}
	.tree li[style*='--depth: 0'] {
		font-weight: 600;
	}
	.desc {
		font-weight: 400;
	}
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
		align-items: flex-end;
	}
	.inline-form .field {
		flex: 1 1 12rem;
	}
	.inline-form .wide {
		flex-basis: 100%;
	}
	.cat-edit {
		margin-bottom: 0.5rem;
	}
	.cat-edit summary {
		cursor: pointer;
		font-weight: 600;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
	}
</style>
