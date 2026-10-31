<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	const t = getT();
</script>

<svelte:head><title>{t('admin.backup')}</title></svelte:head>

<h2>{t('admin.backup')}</h2>
<section class="card" aria-labelledby="full">
	<h3 id="full">{t('backup.fullTitle')}</h3>
	<p>{t('backup.fullText')}</p>
	<a class="btn btn-primary" href="/admin/backup/download" download>{t('backup.download')}</a>
	<p class="hint">{t('backup.restoreHint')}</p>
	<pre><code>node tools/restore.mjs crooked-shelf-backup.zip ./data</code></pre>
</section>

<section class="card" aria-labelledby="other">
	<h3 id="other">{t('backup.otherTitle')}</h3>
	<ul>
		<li><a href="/admin/export">{t('admin.export')}</a> — {t('backup.markdownHint')}</li>
		<li><a href="/admin/world">{t('admin.world')}</a> — {t('backup.worldHint')}</li>
	</ul>
</section>
