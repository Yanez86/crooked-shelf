<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	const t = getT();
</script>

<svelte:head><title>{t('admin.export')}</title></svelte:head>

<h2>{t('admin.export')}</h2>
<section class="card">
	<p>{t('export.intro')}</p>
	<ul>
		<li>{t('export.point1')}</li>
		<li>{t('export.point2')}</li>
		<li>{t('export.point3')}</li>
	</ul>
	<a class="btn btn-primary" href="/admin/export/download" download>{t('export.download')}</a>
</section>
