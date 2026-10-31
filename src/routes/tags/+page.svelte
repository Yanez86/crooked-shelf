<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import TagBadge from '#lib/components/TagBadge.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('nav.tags')} · {page.data.siteName}</title></svelte:head>

<h1>{t('nav.tags')}</h1>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={form && 'ok' in form ? form.ok : null} />

{#if !data.tags.length}
	<p class="muted">{t('tags.empty')}</p>
{:else if !data.canManage}
	<ul class="list-plain cloud">
		{#each data.tags as tag (tag.id)}
			<li><TagBadge {tag} /> <span class="muted">({tag.count})</span></li>
		{/each}
	</ul>
{:else}
	<table class="data">
		<caption class="visually-hidden">{t('nav.tags')}</caption>
		<thead>
			<tr>
				<th scope="col">{t('common.name')}</th>
				<th scope="col">{t('tags.color')}</th>
				<th scope="col">{t('tags.pages')}</th>
				<th scope="col"><span class="visually-hidden">{t('common.actions')}</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.tags as tag (tag.id)}
				<tr>
					<td>
						<form id="tag-{tag.id}" method="post" action="?/update"><input type="hidden" name="id" value={tag.id} /></form>
						<label class="visually-hidden" for="tag-name-{tag.id}">{t('common.name')}</label>
						<input id="tag-name-{tag.id}" form="tag-{tag.id}" name="name" type="text" value={tag.name} required maxlength="40" />
					</td>
					<td>
						<label class="visually-hidden" for="tag-color-{tag.id}">{t('tags.color')}: {tag.name}</label>
						<span class="color-pick">
							<span class="tag-dot tag-{tag.color}" aria-hidden="true"></span>
							<select id="tag-color-{tag.id}" form="tag-{tag.id}" name="color">
								{#each data.colors as c (c)}<option value={c} selected={tag.color === c}>{t('colors.' + c)}</option>{/each}
							</select>
						</span>
					</td>
					<td><a href="/wiki?tag={encodeURIComponent(tag.slug)}">{tag.count}</a></td>
					<td class="row-actions">
						<button class="btn btn-small" type="submit" form="tag-{tag.id}"><Icon name="save" />{t('common.save')}<span class="visually-hidden">: {tag.name}</span></button>
						<form method="post" action="?/delete">
							<input type="hidden" name="id" value={tag.id} />
							<button class="btn btn-small btn-danger" type="submit">{t('common.delete')}<span class="visually-hidden">: {tag.name}</span></button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.cloud {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1rem;
	}
	.color-pick {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	table.data {
		display: block;
		overflow-x: auto;
	}
</style>
