<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const when = (ms: number) => new Date(ms).toLocaleString(data.locale, { dateStyle: 'short', timeStyle: 'short' });
</script>

<svelte:head><title>{t('admin.audit')}</title></svelte:head>

<h2>{t('admin.audit')}</h2>
<p>{t('admin.auditIntro')}</p>

{#if data.rows.length === 0}
	<p class="muted">{t('admin.auditEmpty')}</p>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="table-wrap" tabindex="0">
		<table>
			<thead>
				<tr>
					<th scope="col">{t('admin.auditWhen')}</th>
					<th scope="col">{t('admin.auditWho')}</th>
					<th scope="col">{t('admin.auditAction')}</th>
					<th scope="col">{t('admin.auditDetail')}</th>
					<th scope="col">IP</th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as r (r.id)}
					<tr>
						<td>{when(r.at)}</td>
						<td>{r.user ?? '—'}</td>
						<td>{t('audit.' + r.action)}</td>
						<td>{r.detail}</td>
						<td class="muted">{r.ip}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
