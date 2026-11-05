<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import DeleteCampaign from '#lib/components/DeleteCampaign.svelte';
	import Invites from '#lib/components/Invites.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();

	// Una scheda per indirizzo (?tab=…): i moduli ci tornano dopo l'invio, e l'esito si vede accanto al modulo che l'ha prodotto.
	// Le proprie campagne e una nuova sono di ogni account; le altre schede riguardano la campagna che si gestisce (?id=…),
	// solo da Master. La scheda Appuntamenti c'è solo con l'opzione accesa (in Generale).
	const m = $derived(data.managed);
	const TABS = $derived([
		'campaigns',
		'new',
		...(m ? ['general', 'players', ...(m.campaign.schedule ? ['schedule'] : []), 'claude'] : [])
	]);
	const tab = $derived(TABS.find((x) => x === page.url.searchParams.get('tab')) ?? 'campaigns');
	const href = (x: string) => (x === 'campaigns' ? '/campaign' : m && x !== 'new' ? `/campaign?tab=${x}&id=${m.campaign.id}` : `/campaign?tab=${x}`);
	// Ogni azione del Master dice di quale campagna parla: l'indirizzo del modulo sostituisce quello della pagina.
	const q = $derived(m ? `&id=${m.campaign.id}` : '');
	const msg = (s: string) => (form?.section === s ? form : null);
	const claudeOn = $derived(!!m && (!!m.claude.access || m.claude.clients.length > 0));
	const when = (ms: number) => new Date(ms).toLocaleDateString(page.data.locale, { year: 'numeric', month: 'short', day: 'numeric' });

	let copied = $state(false);
	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head><title>{t('campaign.title')}</title></svelte:head>

<div class="center-column">
	<h1>{t('campaign.title')}</h1>
	<Tabs label={t('campaign.tabsLabel')} links={TABS.map((x) => ({ href: href(x), text: t('campaign.tabs.' + x, { n: m?.players.length ?? 0 }), current: x === tab }))} />
	{#if m && tab !== 'campaigns' && tab !== 'new'}
		<p class="managing">{t('campaign.managing')} <strong>{m.campaign.name}</strong></p>
	{/if}

	{#if tab === 'campaigns'}
		{#if data.campaigns.length}
			<div class="card scroll">
				<table class="data">
					<thead>
						<tr>
							<th scope="col">{t('campaign.name')}</th>
							<th scope="col">{t('campaign.role')}</th>
							<th scope="col" class="col-end"><span class="visually-hidden">{t('common.actions')}</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.campaigns as c (c.id)}
							<tr>
								<td><strong>{c.name}</strong>{#if c.current} <span class="badge">{t('campaign.current')}</span>{/if}</td>
								<td>{t(c.mine ? 'roles.master' : 'roles.player')}{#if !c.mine && c.master} <span class="muted">· {t('campaign.master')}: {c.master}</span>{/if}</td>
								<td class="col-end">
									<div class="row-actions">
										<!-- Nella vista giocatore si guarda soltanto: niente opzioni del Master. -->
										{#if c.mine && !page.data.asPlayer}
											<a class="btn btn-small" href="/campaign?tab=general&id={c.id}">{t('campaign.manage')}<span class="visually-hidden"> {c.name}</span></a>
										{/if}
										{#if !c.current}
											<!-- _top: si entra nella campagna con tutta la wiki, non solo nel popup. -->
											<form method="post" action="?/switch" target="_top">
												<input type="hidden" name="id" value={c.id} />
												<button class="btn btn-small btn-primary" type="submit">{t('campaign.enter')}<span class="visually-hidden"> {c.name}</span></button>
											</form>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p>{t('campaign.none')}</p>
		{/if}
	{:else if tab === 'new'}
		<p>{t('campaign.newIntro')}</p>
		<p class="hint" id="campaign-limit">{t('campaign.limitInfo', { held: data.allowance.held, limit: data.allowance.limit })}</p>
		{#if data.allowance.canCreate}
			<!-- _top: dopo averla creata si entra nella campagna nuova, con tutta la wiki. -->
			<form method="post" action="?/newCampaign&tab=new" target="_top" class="card">
				<FormError error={msg('new')?.error} />
				<div class="field">
					<label for="new-campaign-name">{t('campaign.name')}</label>
					<input id="new-campaign-name" name="name" type="text" required maxlength="80" value={msg('new')?.name ?? ''} aria-describedby="campaign-limit" />
				</div>
				<button class="btn btn-primary" type="submit"><Icon name="plus" />{t('campaign.create')}</button>
			</form>
		{:else}
			<p class="card">{t('campaign.limitReached')}</p>
		{/if}
	{:else if m && tab === 'general'}
		<FormError error={msg('general')?.error} />
		<FormOk message={msg('general')?.ok} />
		<form method="post" action="?/rename&tab=general{q}" class="card">
			<div class="field">
				<label for="campaign-name">{t('campaign.name')}</label>
				<input id="campaign-name" name="name" type="text" required maxlength="80" value={m.campaign.name} />
			</div>
			<!-- Si gestiscono solo le campagne che si tengono: il Master è chi guarda. -->
			<p>{t('campaign.master')}: <strong>{page.data.user?.displayName}</strong></p>
			<button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button>
		</form>

		<h2 id="features-title">{t('campaign.features')}</h2>
		<form method="post" action="?/features&tab=general{q}" class="card" aria-labelledby="features-title">
			<FormOk message={msg('features')?.ok} />
			<div class="field">
				<label class="choice"><input type="checkbox" name="schedule" checked={m.campaign.schedule} aria-describedby="schedule-hint" />{t('campaign.scheduleToggle')}</label>
				<span id="schedule-hint" class="hint">{t('campaign.scheduleHint')}</span>
			</div>
			<button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button>
		</form>

		<h2>{t('campaign.overview')}</h2>
		<dl class="card overview">
			<div>
				<dt>{t('campaign.players')}</dt>
				<dd><a href={href('players')}>{m.players.length}</a></dd>
			</div>
			<div>
				<dt>{t('admin.activeInvites')}</dt>
				<dd><a href={href('players')}>{m.invites.length}</a></dd>
			</div>
			<div>
				<dt>{t('claude.title')}</dt>
				<dd><a href={href('claude')}>{claudeOn ? t('campaign.claudeOn') : t('campaign.claudeOff')}</a></dd>
			</div>
		</dl>

		<h2>{t('campaign.danger')}</h2>
		<DeleteCampaign id={m.campaign.id} name={m.campaign.name} query="&tab=general{q}" />
	{:else if m && tab === 'players'}
		<FormError error={msg('players')?.error} />
		<FormOk message={msg('players')?.ok} />
		<h2>{t('campaign.players')}</h2>
		{#if m.players.length}
			<div class="card">
				<table class="data">
					<thead>
						<tr>
							<th scope="col">{t('campaign.player')}</th>
							<th scope="col" class="col-end"><span class="visually-hidden">{t('common.actions')}</span></th>
						</tr>
					</thead>
					<tbody>
						{#each m.players as p (p.id)}
							<tr>
								<td>
									{#if p.sheet}<a href="/wiki/{p.sheet}">{p.displayName}</a>{:else}{p.displayName}{/if}
									<span class="muted">@{p.username}</span>
									{#if !p.sheet}<span class="muted">· {t('campaign.noSheet')}</span>{/if}
								</td>
								<td class="col-end">
									<form method="post" action="?/remove&tab=players{q}">
										<input type="hidden" name="id" value={p.id} />
										<button class="btn btn-small btn-danger" type="submit">{t('campaign.remove')}<span class="visually-hidden"> {p.displayName}</span></button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="muted">{t('campaign.noPlayers')}</p>
		{/if}

		<h2>{t('admin.invites')}</h2>
		<p>{t('campaign.inviteIntro')}</p>
		<Invites invites={m.invites} form={form?.section === 'players' && 'link' in form ? { link: form.link, role: form.role } : null} query="&tab=players{q}" />

		{#if m.sheets}
			<h2 id="sheets-title">{t('sheets.templateTitle')}</h2>
			<p>{t('sheets.templateIntro')}</p>
			<form method="post" action="?/sheetTemplate&tab=players{q}" class="card" aria-labelledby="sheets-title">
				<FormError error={msg('sheets')?.error} />
				<FormOk message={msg('sheets')?.ok} />
				<div class="field">
					<label for="sheet-template">{t('sheets.templateLabel')}</label>
					<select id="sheet-template" name="template">
						<option value="" selected={!m.sheets.current}>{t('sheets.blank')}</option>
						{#each m.sheets.templates as tp (tp.slug)}
							<option value={tp.slug} selected={m.sheets.current === tp.slug}>{tp.title}</option>
						{/each}
					</select>
				</div>
				<button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button>
			</form>
		{/if}
	{:else if m && tab === 'schedule'}
		<p>{t('schedule.settingsIntro')}</p>
		<form method="post" action="?/schedule&tab=schedule{q}" class="card" aria-label={t('schedule.title')}>
			<FormError error={msg('schedule')?.error} />
			<FormOk message={msg('schedule')?.ok} />
			<div class="field">
				<label for="remote-link">{t('schedule.fields.campaignLink')}</label>
				<input id="remote-link" name="remoteLink" type="url" maxlength="500" value={m.campaign.remoteLink ?? ''} placeholder="https://discord.gg/…" />
			</div>
			<div class="field">
				<label for="min-players">{t('schedule.fields.minPlayers')}</label>
				<input id="min-players" name="minPlayers" type="number" min="0" max="50" required value={m.campaign.minPlayers} aria-describedby="min-players-hint" />
				<span id="min-players-hint" class="hint">{t('schedule.fields.minPlayersHint')}</span>
			</div>
			<div class="field">
				<label for="quorum-hours">{t('schedule.fields.quorumHours')}</label>
				<input id="quorum-hours" name="quorumHours" type="number" min="0" max="336" required value={m.campaign.quorumHours} />
			</div>
			<div class="field">
				<label class="choice"><input type="checkbox" name="starWishes" checked={m.campaign.starWishes} aria-describedby="star-wishes-hint" />{t('schedule.starWishes.toggle')}</label>
				<span id="star-wishes-hint" class="hint">{t('schedule.starWishes.toggleHint')}</span>
			</div>
			<button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button>
		</form>
	{:else if m}
		<p>{t('claude.intro')}</p>
		<FormError error={msg('claude')?.error} />
		<FormOk message={msg('claude')?.ok} />

		<section aria-labelledby="claude-status">
			<h2 id="claude-status">{t('claude.statusTitle')}</h2>
			<div class="card stack">
				<p>{t('claude.access.' + (m.claude.access ?? 'none'))}{#if m.claude.token} <span class="muted">{t('claude.when', { created: when(m.claude.token.createdAt), used: m.claude.token.lastUsedAt ? when(m.claude.token.lastUsedAt) : t('claude.never') })}</span>{/if}</p>
				{#if m.claude.clients.length}
					<ul>
						{#each m.claude.clients as c (c.client)}
							<li>{t('claude.client', { client: c.client })} <span class="muted">{t('claude.when', { created: when(c.createdAt), used: c.lastUsedAt ? when(c.lastUsedAt) : t('claude.never') })}</span></li>
						{/each}
					</ul>
				{:else}
					<p>{t('claude.noClients')}</p>
				{/if}
				<p class="hint">{t('claude.idleHint')}</p>
				{#if claudeOn}
					<form method="post" action="?/claudeRevoke&tab=claude{q}">
						<button class="btn btn-danger" type="submit" aria-describedby="claude-revoke-hint">{t('admin.revoke')}</button>
					</form>
					<p id="claude-revoke-hint" class="hint">{t('claude.revokeHint')}</p>
				{/if}
			</div>
		</section>

		<section aria-labelledby="claude-connector-title">
			<h2 id="claude-connector-title">{t('claude.connectorTitle')}</h2>
			<p>{t('claude.connectorIntro')}</p>
			<div class="card stack">
				<div class="field">
					<label for="claude-connector">{t('claude.connector')}</label>
					<div class="link-row">
						<input id="claude-connector" type="text" readonly value={m.claude.connector} onfocus={(e) => e.currentTarget.select()} />
						<button class="btn" type="button" onclick={() => copy(m!.claude.connector)}>{t('admin.copy')}</button>
					</div>
					<p class="hint" aria-live="polite">{copied ? t('admin.copied') : ''}</p>
				</div>
				<ol>
					<li>{t('claude.step1')}</li>
					<li>{t('claude.step2')}</li>
					<li>{t('claude.step3')}</li>
				</ol>
				<p class="hint">{t('claude.connectorHint')} {t('claude.connectorReach')}</p>
			</div>
		</section>

		<section aria-labelledby="claude-plugin-title">
			<h2 id="claude-plugin-title">{t('claude.pluginTitle')}</h2>
			<p>{t('claude.pluginIntro')}</p>
			<pre class="card"><code>claude plugin marketplace add Yanez86/crooked-shelf
claude plugin install crooked-shelf@crooked-shelf</code></pre>
			{#if form?.section === 'claude' && 'token' in form}
				<div class="alert alert-ok" role="status">
					<p>{t('claude.once')}</p>
					<div class="field">
						<label for="claude-url">{t('claude.url')}</label>
						<input id="claude-url" type="text" readonly value={form.url} onfocus={(e) => e.currentTarget.select()} />
					</div>
					<div class="field">
						<label for="claude-token">{t('claude.token')}</label>
						<input id="claude-token" type="text" readonly autocomplete="off" value={form.token} onfocus={(e) => e.currentTarget.select()} />
					</div>
				</div>
			{/if}
			<form method="post" action="?/claude&tab=claude{q}" class="card stack">
				<label class="choice">
					<input type="checkbox" name="write" checked={m.claude.access === 'write'} aria-describedby="claude-write-hint" />
					<span>{t('claude.write')}<br /><span id="claude-write-hint" class="hint">{t('claude.writeHint')}</span></span>
				</label>
				<button class="btn btn-primary" type="submit">{m.claude.access ? t('claude.replace') : t('claude.create')}</button>
			</form>
		</section>

		<section aria-labelledby="claude-can-title">
			<h2 id="claude-can-title">{t('claude.canTitle')}</h2>
			<ul>
				<li>{t('claude.canRead')}</li>
				<li>{t('claude.canWrite')}</li>
				<li>{t('claude.cannot')}</li>
			</ul>
			<p class="hint">{t('claude.safety')}</p>
		</section>
	{/if}
</div>

<style>
	.managing {
		color: var(--c-muted);
	}
	.row-actions {
		display: inline-flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.row-actions form {
		margin: 0;
	}
	.scroll {
		overflow-x: auto;
	}
	.overview {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 1rem;
		margin: 0;
	}
	.overview dt {
		color: var(--c-muted);
		font-size: var(--fs-sm);
	}
	.overview dd {
		margin: 0;
		font-family: var(--font-head);
		font-size: var(--fs-xl);
		font-weight: 700;
	}
	.stack {
		display: grid;
		justify-items: start;
		gap: 0.75rem;
	}
	.stack p,
	.stack ol {
		margin: 0;
	}
	.stack .field {
		width: 100%;
		margin: 0;
	}
	.link-row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.3rem;
	}
	.link-row input {
		flex: 1;
		min-width: 0;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
	}
	pre {
		overflow-x: auto;
		font-size: var(--fs-sm);
	}
</style>
