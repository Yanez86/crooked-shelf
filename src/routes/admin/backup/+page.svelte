<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import { formatSize } from '#lib/resources.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const when = (ms: number) => new Date(ms).toLocaleString(data.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: data.timeZone });
	const hours = Array.from({ length: 24 }, (_, h) => h);
	const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
	const st = $derived(data.status);
</script>

<svelte:head><title>{t('admin.backup')}</title></svelte:head>

<h2>{t('admin.backup')}</h2>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={form && 'ok' in form ? form.ok : null} />

<section class="card" aria-labelledby="full">
	<h3 id="full">{t('backup.fullTitle')}</h3>
	<p>{t('backup.fullText')}</p>
	<a class="btn btn-primary" href="/admin/backup/download" download>{t('backup.download')}</a>
	<p class="hint">{t('backup.downloadPlain')}</p>
	<p class="hint">{t('backup.restoreHint')}</p>
	<pre><code>node tools/restore.mjs crooked-shelf-backup.zip ./data</code></pre>
</section>

<section class="card" aria-labelledby="contents">
	<h3 id="contents">{t('backup.contentsTitle')}</h3>
	<div class="callout callout-warning">
		<p class="callout-title">{t('backup.contentsWarning')}</p>
		<ul>
			<li>{t('backup.contentsCampaigns')}</li>
			<li>{t('backup.contentsFiles')}</li>
			<li>{t('backup.contentsAccounts')}</li>
			<li>{t('backup.contentsLog')}</li>
		</ul>
		<p>{t('backup.contentsPlain')}</p>
	</div>
</section>

<section class="card" aria-labelledby="auto">
	<h3 id="auto">{t('backup.autoTitle')}</h3>
	<p>{t('backup.autoText')}</p>
	<p><strong>{t('backup.folder')}</strong> <code class="path">{data.dir}</code></p>
	{#if !data.custom}
		<div class="callout callout-warning">
			<p class="callout-title">{t('backup.folderDefaultTitle')}</p>
			<p>{t('backup.folderDefaultText')}</p>
		</div>
	{/if}

	<dl class="status">
		<dt>{t('backup.last')}</dt>
		<dd>
			{#if !st.lastAt}
				{t('backup.lastNone')}
			{:else if st.lastOk}
				<strong>{t('backup.lastOk')}</strong> — {when(st.lastAt)}: <code class="path">{st.lastFile}</code> ({formatSize(st.lastSize, data.locale)})
			{:else}
				<strong class="failed">{t('backup.lastFailed')}</strong> — {when(st.lastAt)}: {t(st.lastError || 'backup.errOther')}
				{#if st.lastDetail}<br /><code class="path">{st.lastDetail}</code>{/if}
			{/if}
		</dd>
		<dt>{t('backup.next')}</dt>
		<dd>
			{#if data.running}{t('backup.running')}{:else if data.next}{when(data.next)}{:else}{t('backup.off')}{/if}
		</dd>
		<dt>{t('backup.encryption')}</dt>
		<dd>{data.auto.encrypted ? t('backup.encryptionOnShort') : t('backup.encryptionOffShort')}</dd>
	</dl>

	<form method="post" action="?/auto">
		<label class="choice">
			<input type="checkbox" name="enabled" checked={data.auto.enabled} />
			<span>{t('backup.enabled')}</span>
		</label>
		<div class="cols">
			<div class="field">
				<label for="hour">{t('backup.hour')}</label>
				<select id="hour" name="hour" aria-describedby="hour-hint">
					{#each hours as h (h)}<option value={h} selected={data.auto.hour === h}>{hourLabel(h)}</option>{/each}
				</select>
				<p id="hour-hint" class="hint">{t('backup.hourHint', { zone: data.timeZone })}</p>
			</div>
			<div class="field">
				<label for="keep">{t('backup.keep')}</label>
				<input id="keep" name="keep" type="number" min="1" max={data.keepMax} required value={data.auto.keep} aria-describedby="keep-hint" />
				<p id="keep-hint" class="hint">{t('backup.keepHint')}</p>
			</div>
		</div>
		<div class="actions"><button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button></div>
	</form>

	<form method="post" action="?/run" class="run">
		<button class="btn" type="submit" disabled={data.running} aria-describedby="run-hint"><Icon name="clock" />{t('backup.runNow')}</button>
		<p id="run-hint" class="hint">{t('backup.runHint')}</p>
	</form>
</section>

<section class="card" aria-labelledby="enc">
	<h3 id="enc">{t('backup.encTitle')}</h3>
	<p>{t('backup.encText')}</p>

	{#if data.auto.encrypted}
		<p><Icon name="lock" /> <strong>{t('backup.encOnLead')}</strong> {t('backup.encOnText')}</p>

		<form method="post" action="?/check" class="inline-form">
			<div class="field">
				<label for="check-password">{t('backup.password')}</label>
				<input id="check-password" name="password" type="password" required autocomplete="off" aria-describedby="check-hint" />
				<p id="check-hint" class="hint">{t('backup.checkHint')}</p>
			</div>
			<div class="actions"><button class="btn" type="submit"><Icon name="check" />{t('backup.check')}</button></div>
		</form>

		<details class="disclosure" open={form && 'section' in form && form.section === 'encrypt'}>
			<summary class="btn">{t('backup.changePassword')}</summary>
			<p>{t('backup.changeText')}</p>
			{@render passwordForm(t('backup.changePassword'))}
		</details>

		<details class="disclosure" open={form && 'section' in form && form.section === 'plain'}>
			<summary class="btn">{t('backup.plainTitle')}</summary>
			<form method="post" action="?/plain">
				<p>{t('backup.plainText')}</p>
				<label class="choice">
					<input type="checkbox" name="confirmPlain" required />
					<span>{t('backup.confirmPlain')}</span>
				</label>
				<div class="actions"><button class="btn btn-danger" type="submit">{t('backup.plainTitle')}</button></div>
			</form>
		</details>
	{:else}
		<p><strong>{t('backup.encOffLead')}</strong> {t('backup.encOffText')}</p>
		{@render passwordForm(t('backup.encryptNow'))}
	{/if}
</section>

<section class="card" aria-labelledby="other">
	<h3 id="other">{t('backup.otherTitle')}</h3>
	<ul>
		<li><a href="/admin/export">{t('admin.export')}</a> — {t('backup.markdownHint')}</li>
		<li><a href="/admin/world">{t('admin.world')}</a> — {t('backup.worldHint')}</li>
	</ul>
</section>

{#snippet passwordForm(submit: string)}
	<form method="post" action="?/encrypt">
		<div class="callout callout-warning">
			<p class="callout-title">{t('backup.lostTitle')}</p>
			<p>{t('backup.lostText')}</p>
		</div>
		<div class="cols">
			<div class="field">
				<label for="new-password">{t('backup.password')}</label>
				<input
					id="new-password"
					name="password"
					type="password"
					required
					minlength={data.passwordMin}
					maxlength="256"
					autocomplete="new-password"
					aria-describedby="new-password-hint"
				/>
				<p id="new-password-hint" class="hint">{t('backup.passwordHint', { n: data.passwordMin })}</p>
			</div>
			<div class="field">
				<label for="new-confirm">{t('backup.passwordConfirm')}</label>
				<input id="new-confirm" name="confirm" type="password" required minlength={data.passwordMin} maxlength="256" autocomplete="new-password" />
			</div>
		</div>
		<label class="choice">
			<input type="checkbox" name="understood" required />
			<span>{t('backup.understood')}</span>
		</label>
		<div class="actions"><button class="btn btn-primary" type="submit"><Icon name="lock" />{submit}</button></div>
	</form>
{/snippet}

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0 1.5rem;
	}
	.path {
		overflow-wrap: anywhere;
	}
	.status {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.35rem 1rem;
		margin: 1rem 0;
	}
	.status dt {
		font-weight: 700;
	}
	.status dd {
		margin: 0;
	}
	.failed {
		color: var(--c-danger);
	}
	.run {
		margin-top: 1rem;
	}
	.inline-form {
		margin-bottom: 1rem;
	}
	.disclosure + .disclosure {
		margin-top: 0.75rem;
	}
	@media (max-width: 30rem) {
		.status {
			grid-template-columns: 1fr;
		}
		.status dd {
			margin-bottom: 0.5rem;
		}
	}
</style>
