<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	let announce = $state('');
	let editing = $state<number | null>(null);
	let dragId = $state<number | null>(null);

	const DIRS = [
		{ dir: 'left', icon: '←', key: 'boards.moveLeft' },
		{ dir: 'up', icon: '↑', key: 'boards.moveUp' },
		{ dir: 'down', icon: '↓', key: 'boards.moveDown' },
		{ dir: 'right', icon: '→', key: 'boards.moveRight' }
	] as const;

	/** Dopo uno spostamento il focus resta sul pulsante usato, così si può continuare a spostare. */
	const afterMove = (id: number, dir: string) => () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
		await update({ reset: false });
		announce = t('boards.moved');
		await tick();
		(document.getElementById(`move-${id}-${dir}`) ?? document.getElementById(`card-${id}`))?.focus();
	};

	const keepOpen = () => async ({ update, result }: { update: (o?: { reset?: boolean }) => Promise<void>; result: { type: string } }) => {
		await update();
		if (result.type === 'success') editing = null;
	};

	async function drop(columnId: number, index: number) {
		if (dragId === null) return;
		const id = dragId;
		dragId = null;
		const r = await fetch(`/api/boards/${data.board.id}/cards/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ columnId, index })
		});
		announce = r.ok ? t('boards.moved') : t('errors.generic');
		await refreshAll();
	}
</script>

<svelte:head><title>{data.board.title} · {page.data.siteName}</title></svelte:head>

<p><a href="/boards">← {t('nav.boards')}</a></p>
<h1>{data.board.title}</h1>
<p class="muted">
	{data.board.personal ? t('boards.kindMine') : t('boards.kindShared')}
	{#if data.board.visibility === 'master'} · {t('visibility.master')}{/if}
	· {t('boards.howTo')}
</p>
<FormError error={form && 'error' in form ? form.error : null} />
<p class="visually-hidden" aria-live="polite">{announce}</p>

<div class="board" role="list" aria-label={t('boards.columnsLabel')}>
	{#each data.columns as col, ci (col.id)}
		<section
			class="column"
			role="listitem"
			aria-labelledby="col-{col.id}"
			ondragover={(e) => { if (dragId !== null) e.preventDefault(); }}
			ondrop={(e) => { e.preventDefault(); drop(col.id, col.cards.length); }}
		>
			<h2 id="col-{col.id}">{col.title} <span class="count">({col.cards.length})</span></h2>
			<ol class="list-plain cards">
				{#each col.cards as card, i (card.id)}
					<li
						class="card-item color-{card.color}"
						draggable="true"
						ondragstart={() => (dragId = card.id)}
						ondragend={() => (dragId = null)}
						ondragover={(e) => { if (dragId !== null) e.preventDefault(); }}
						ondrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(col.id, i); }}
					>
						<article aria-labelledby="card-{card.id}">
							<h3 id="card-{card.id}" tabindex="-1">{card.title}</h3>
							{#if card.html}<p class="body">{@html card.html}</p>{/if}
							{#if card.author}<p class="by">{card.author}</p>{/if}
							<div class="tools">
								{#each DIRS as d (d.dir)}
									{@const disabled =
										(d.dir === 'left' && ci === 0) ||
										(d.dir === 'right' && ci === data.columns.length - 1) ||
										(d.dir === 'up' && i === 0) ||
										(d.dir === 'down' && i === col.cards.length - 1)}
									<form method="post" action="?/moveCard" use:enhance={afterMove(card.id, d.dir)}>
										<input type="hidden" name="id" value={card.id} />
										<input type="hidden" name="dir" value={d.dir} />
										<button id="move-{card.id}-{d.dir}" class="mini" type="submit" {disabled} aria-label="{t(d.key)}: {card.title}" title={t(d.key)}>{d.icon}</button>
									</form>
								{/each}
								<button class="mini" type="button" aria-expanded={editing === card.id} onclick={() => (editing = editing === card.id ? null : card.id)}>
									✎<span class="visually-hidden">{t('page.edit')}: {card.title}</span>
								</button>
							</div>
							{#if editing === card.id}
								<form method="post" action="?/updateCard" class="edit" use:enhance={keepOpen}>
									<input type="hidden" name="id" value={card.id} />
									<div class="field">
										<label for="t-{card.id}">{t('page.title')}</label>
										<input id="t-{card.id}" name="title" type="text" required maxlength="120" value={card.title} />
									</div>
									<div class="field">
										<label for="b-{card.id}">{t('boards.body')}</label>
										<textarea id="b-{card.id}" name="body" rows="3" maxlength="2000">{card.body}</textarea>
									</div>
									<div class="field">
										<label for="c-{card.id}">{t('tags.color')}</label>
										<select id="c-{card.id}" name="color">
											{#each data.colors as c (c)}<option value={c} selected={card.color === c}>{t('colors.' + c)}</option>{/each}
										</select>
									</div>
									<div class="actions">
										<button class="btn btn-small btn-primary" type="submit">{t('common.save')}</button>
									</div>
								</form>
								<form method="post" action="?/deleteCard" use:enhance>
									<input type="hidden" name="id" value={card.id} />
									<button class="btn btn-small btn-danger" type="submit">{t('common.delete')}<span class="visually-hidden">: {card.title}</span></button>
								</form>
							{/if}
						</article>
					</li>
				{/each}
			</ol>

			<details class="add">
				<summary>+ {t('boards.addCard')}<span class="visually-hidden">: {col.title}</span></summary>
				<form method="post" action="?/addCard" use:enhance>
					<input type="hidden" name="columnId" value={col.id} />
					<div class="field">
						<label for="nt-{col.id}">{t('page.title')}</label>
						<input id="nt-{col.id}" name="title" type="text" required maxlength="120" />
					</div>
					<div class="field">
						<label for="nb-{col.id}">{t('boards.body')}</label>
						<textarea id="nb-{col.id}" name="body" rows="3" maxlength="2000" aria-describedby="nb-hint-{col.id}"></textarea>
						<span id="nb-hint-{col.id}" class="hint">{t('boards.bodyHint')}</span>
					</div>
					<div class="field">
						<label for="nc-{col.id}">{t('tags.color')}</label>
						<select id="nc-{col.id}" name="color">
							{#each data.colors as c (c)}<option value={c}>{t('colors.' + c)}</option>{/each}
						</select>
					</div>
					<button class="btn btn-small btn-primary" type="submit">{t('boards.addCard')}</button>
				</form>
			</details>

			{#if data.canManage}
				<details class="add">
					<summary>⚙ {t('boards.columnSettings')}<span class="visually-hidden">: {col.title}</span></summary>
					<form method="post" action="?/renameColumn" use:enhance class="inline">
						<input type="hidden" name="id" value={col.id} />
						<label class="visually-hidden" for="cn-{col.id}">{t('boards.columnName')}</label>
						<input id="cn-{col.id}" name="title" type="text" required maxlength="60" value={col.title} />
						<button class="btn btn-small" type="submit">{t('common.save')}</button>
					</form>
					<div class="inline">
						<form method="post" action="?/shiftColumn" use:enhance>
							<input type="hidden" name="id" value={col.id} /><input type="hidden" name="dir" value="left" />
							<button class="btn btn-small" type="submit" disabled={ci === 0}>← {t('boards.colLeft')}</button>
						</form>
						<form method="post" action="?/shiftColumn" use:enhance>
							<input type="hidden" name="id" value={col.id} /><input type="hidden" name="dir" value="right" />
							<button class="btn btn-small" type="submit" disabled={ci === data.columns.length - 1}>{t('boards.colRight')} →</button>
						</form>
						<form method="post" action="?/deleteColumn" use:enhance>
							<input type="hidden" name="id" value={col.id} />
							<button class="btn btn-small btn-danger" type="submit">{t('boards.deleteColumn')}</button>
						</form>
					</div>
				</details>
			{/if}
		</section>
	{/each}
</div>

{#if data.canManage}
	<section class="manage" aria-labelledby="manage-title">
		<h2 id="manage-title">{t('boards.manage')}</h2>
		<form method="post" action="?/addColumn" use:enhance class="inline card">
			<label for="new-col">{t('boards.newColumn')}</label>
			<input id="new-col" name="title" type="text" required maxlength="60" />
			<button class="btn btn-small" type="submit">{t('categories.add')}</button>
		</form>
		<form method="post" action="?/updateBoard" use:enhance class="inline card">
			<label for="board-title">{t('page.title')}</label>
			<input id="board-title" name="title" type="text" required maxlength="80" value={data.board.title} />
			{#if !data.board.personal}
				<label class="choice"><input type="checkbox" name="visibility" value="master" checked={data.board.visibility === 'master'} /><span>{t('boards.masterOnly')}</span></label>
			{/if}
			<button class="btn btn-small" type="submit">{t('common.save')}</button>
		</form>
		<form method="post" action="?/deleteBoard" class="inline">
			<label class="choice"><input type="checkbox" name="confirm" required /><span>{t('boards.deleteConfirm', { title: data.board.title })}</span></label>
			<button class="btn btn-small btn-danger" type="submit">{t('boards.delete')}</button>
		</form>
	</section>
{/if}

<style>
	.board {
		display: flex;
		gap: 1rem;
		overflow-x: auto;
		padding-bottom: 1rem;
		align-items: flex-start;
	}
	.column {
		flex: 0 0 min(19rem, 85vw);
		background: var(--c-surface2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		padding: 0.5rem 0.75rem 0.75rem;
	}
	.column h2 {
		font-size: 1.15rem;
		margin: 0.25rem 0 0.75rem;
	}
	.count {
		font-weight: 400;
		color: var(--c-muted);
		font-size: 0.95rem;
	}
	.cards {
		display: grid;
		gap: 0.6rem;
		min-height: 2rem;
	}
	.card-item {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-top: 6px solid var(--card, #e8c534);
		border-radius: var(--radius);
		padding: 0.5rem 0.65rem;
		cursor: grab;
	}
	.color-yellow { --card: #e8c534; }
	.color-blue { --card: #3b73d1; }
	.color-green { --card: #3fa45b; }
	.color-pink { --card: #d6559b; }
	.color-purple { --card: #8a55c9; }
	.color-gray { --card: #8a8a8a; }
	h3 {
		font-size: 1.05rem;
		margin: 0 0 0.25rem;
	}
	.body {
		margin: 0 0 0.25rem;
		overflow-wrap: anywhere;
	}
	.by {
		margin: 0;
		font-size: 0.85rem;
		color: var(--c-muted);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.4rem;
	}
	.mini {
		min-width: 2.25rem;
		min-height: 2.25rem;
		border: 1px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface);
		color: var(--c-text);
		cursor: pointer;
		font: inherit;
	}
	.mini:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.edit {
		margin-top: 0.5rem;
	}
	.add {
		margin-top: 0.75rem;
	}
	.add summary {
		cursor: pointer;
		min-height: 2.5rem;
		display: flex;
		align-items: center;
		font-weight: 600;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin: 0.5rem 0;
	}
	.manage {
		margin-top: 2rem;
		max-width: 48rem;
	}
</style>
