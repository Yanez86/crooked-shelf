<script lang="ts">
	import 'leaflet/dist/leaflet.css';
	import { onDestroy, onMount } from 'svelte';
	import type * as Leaflet from 'leaflet';
	import { PIN_HEX, PIN_ICON } from './icons.ts';
	import { iconPath } from '../icons.ts';
	import { getT } from '../i18n/index.ts';

	export interface ViewPin {
		id: number;
		x: number;
		y: number;
		label: string;
		html: string;
		icon: string;
		color: string;
		page: { slug: string; title: string; missing?: boolean } | null;
		target: { slug: string; title: string } | null;
	}

	let {
		src,
		width,
		height,
		title,
		pins,
		editable = false,
		adding = false,
		measuring = false,
		showLabels = false,
		scale = null,
		unit = '',
		onpick,
		onmove,
		onedit,
		onmeasure,
		onopen
	}: {
		src: string;
		width: number;
		height: number;
		title: string;
		pins: ViewPin[];
		editable?: boolean;
		adding?: boolean;
		measuring?: boolean;
		showLabels?: boolean;
		scale?: number | null;
		unit?: string;
		onpick?: (x: number, y: number) => void;
		onmove?: (id: number, x: number, y: number) => void;
		onedit?: (id: number) => void;
		onmeasure?: (distance: number | null) => void;
		/** Clic su un pin con una pagina: chi usa la mappa la apre in sovraimpressione. Senza, c'è il fumetto. */
		onopen?: (pin: ViewPin) => void;
	} = $props();

	const t = getT();
	let el: HTMLDivElement;
	let L: typeof Leaflet | undefined = $state();
	let map: Leaflet.Map | undefined;
	let pinLayer: Leaflet.LayerGroup | undefined;
	let measureLayer: Leaflet.LayerGroup | undefined;
	let measurePts: Leaflet.LatLng[] = [];
	const markers = new Map<number, Leaflet.Marker>();

	// Coordinate dell'immagine (x da sinistra, y dall'alto) <-> coordinate Leaflet.
	const toLL = (x: number, y: number): Leaflet.LatLngExpression => [height - y, x];
	const fromLL = (ll: Leaflet.LatLng) => ({ x: Math.round(ll.lng * 10) / 10, y: Math.round((height - ll.lat) * 10) / 10 });

	const esc = (s: string) =>
		s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

	function popupHtml(p: ViewPin) {
		const parts = [`<p class="pin-title">${esc(p.label)}</p>`];
		if (p.html) parts.push(`<p>${p.html}</p>`);
		if (p.page && !p.page.missing) parts.push(`<p><a href="/wiki/${encodeURIComponent(p.page.slug)}">${esc(t('maps.openPage', { title: p.page.title }))}</a></p>`);
		if (p.page?.missing)
			parts.push(`<p><a class="wikilink missing" href="/wiki/new?${esc(new URLSearchParams({ title: p.label, slug: p.page.slug }).toString())}">${esc(t('maps.createPage'))}</a></p>`);
		if (p.target) parts.push(`<p><a href="/maps/${encodeURIComponent(p.target.slug)}">${esc(t('maps.openMap', { title: p.target.title }))}</a></p>`);
		if (editable) parts.push(`<p><button type="button" class="btn btn-small" data-edit-pin="${p.id}">${esc(t('maps.editPin'))}</button></p>`);
		return parts.join('');
	}

	function drawPins() {
		if (!L || !map || !pinLayer) return;
		pinLayer.clearLayers();
		markers.clear();
		for (const p of pins) {
			const color = PIN_HEX[p.color] ?? PIN_HEX.red;
			const icon = L.divIcon({
				className: 'cs-pin',
				html: `<span class="cs-pin-dot" style="background:${color}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${iconPath(PIN_ICON[p.icon] ?? 'dot')}"/></svg></span>`,
				iconSize: [34, 34],
				iconAnchor: [17, 17],
				popupAnchor: [0, -16]
			});
			const m = L.marker(toLL(p.x, p.y), { icon, keyboard: true, draggable: editable, title: p.label, riseOnHover: true, autoPanOnFocus: true });
			const opens = !!(onopen && p.page && !p.page.missing);
			// Come fa il fumetto di Leaflet: si apre col clic e con Invio.
			if (opens)
				m.on('click', () => onopen?.(p)).on('keypress', (e: Leaflet.LeafletKeyboardEvent) => {
					if (e.originalEvent.key === 'Enter') onopen?.(p);
				});
			else m.bindPopup(popupHtml(p), { maxWidth: 320 });
			m.bindTooltip(esc(p.label), { direction: 'top', offset: [0, -16], permanent: showLabels, className: 'cs-pin-label' });
			m.on('add', () => {
				const e = m.getElement();
				e?.setAttribute('aria-label', p.label);
				e?.setAttribute('role', 'button');
				if (opens) e?.setAttribute('aria-haspopup', 'dialog');
			});
			if (editable) m.on('dragend', () => { const c = fromLL(m.getLatLng()); onmove?.(p.id, c.x, c.y); });
			m.addTo(pinLayer);
			markers.set(p.id, m);
		}
	}

	function resetMeasure() {
		measurePts = [];
		measureLayer?.clearLayers();
		onmeasure?.(null);
	}

	/** Centro della vista attuale, in coordinate dell'immagine (per aggiungere un pin senza mouse). */
	export function center() {
		return map ? fromLL(map.getCenter()) : { x: width / 2, y: height / 2 };
	}

	export function openPin(id: number) {
		if (!map || !pinLayer) return;
		const p = pins.find((q) => q.id === id);
		if (!p) return;
		map.setView(toLL(p.x, p.y), Math.max(map.getZoom(), 0));
		const mk = markers.get(id);
		mk?.openPopup();
		mk?.getElement()?.focus();
	}

	onMount(() => {
		let cancelled = false;
		import('leaflet').then((mod) => {
			if (cancelled) return;
			L = mod.default ?? mod;
			const bounds = L.latLngBounds([0, 0], [height, width]);
			map = L.map(el, {
				crs: L.CRS.Simple,
				minZoom: -6,
				maxZoom: 4,
				zoomSnap: 0.25,
				zoomDelta: 0.5,
				maxBounds: bounds.pad(0.25),
				attributionControl: false,
				keyboard: true
			});
			L.imageOverlay(src, bounds, { alt: '' }).addTo(map);
			map.fitBounds(bounds);
			map.setMinZoom(map.getZoom() - 1);
			pinLayer = L.layerGroup().addTo(map);
			measureLayer = L.layerGroup().addTo(map);
			map.getContainer().setAttribute('aria-label', t('maps.mapLabel', { title }));
			map.getContainer().setAttribute('role', 'region');
			map.on('click', (e: Leaflet.LeafletMouseEvent) => {
				const c = fromLL(e.latlng);
				if (c.x < 0 || c.y < 0 || c.x > width || c.y > height) return;
				if (measuring) {
					measurePts.push(e.latlng);
					L!.circleMarker(e.latlng, { radius: 4, color: '#000', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(measureLayer!);
					if (measurePts.length > 1) {
						L!.polyline(measurePts.slice(-2), { color: '#000', weight: 3, dashArray: '6 6' }).addTo(measureLayer!);
						let d = 0;
						for (let i = 1; i < measurePts.length; i++) d += map!.distance(measurePts[i - 1], measurePts[i]);
						onmeasure?.(d * (scale ?? 1));
					}
				} else if (adding) onpick?.(c.x, c.y);
			});
			map.on('popupopen', (e: Leaflet.PopupEvent) => {
				const b = e.popup.getElement()?.querySelector<HTMLButtonElement>('[data-edit-pin]');
				b?.addEventListener('click', () => onedit?.(Number(b.dataset.editPin)));
			});
			drawPins();
		});
		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => map?.remove());

	$effect(() => {
		void pins;
		void showLabels;
		void editable;
		if (L) drawPins();
	});

	$effect(() => {
		if (!measuring && measurePts.length) resetMeasure();
	});

	$effect(() => {
		el?.classList.toggle('picking', adding || measuring);
	});
</script>

<!-- Leaflet rende la mappa raggiungibile con Tab: frecce per spostarsi, + e − per lo zoom. -->
<div class="map" bind:this={el}></div>

<style>
	.map {
		width: 100%;
		height: min(70vh, 40rem);
		min-height: 20rem;
		border: 2px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface2);
	}
	.map:global(.picking) {
		cursor: crosshair;
	}
	.map :global(.leaflet-container),
	.map:global(.leaflet-container) {
		font: inherit;
		background: var(--c-surface2);
	}
	.map :global(.cs-pin) {
		background: none;
		border: none;
	}
	.map :global(.cs-pin-dot) {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius);
		border: 3px solid #fff;
		box-shadow: 0 0 0 2px #000, 0 2px 6px rgb(0 0 0 / 0.5);
		color: #fff;
		line-height: 1;
	}
	.map :global(.cs-pin-dot svg) {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.map :global(.leaflet-marker-icon:focus-visible) {
		outline: 3px solid var(--c-focus);
		outline-offset: 3px;
		border-radius: var(--radius);
	}
	.map :global(.cs-pin-label) {
		font-weight: 700;
		font-size: var(--fs-sm);
		background: #fff;
		color: #111;
		border: 1px solid #111;
	}
	.map :global(.leaflet-popup-content-wrapper),
	.map :global(.leaflet-popup-tip) {
		background: var(--c-surface);
		color: var(--c-text);
	}
	.map :global(.leaflet-popup-content) {
		font-size: 1rem;
		line-height: 1.5;
	}
	.map :global(.leaflet-popup-content p) {
		margin: 0.35rem 0;
	}
	.map :global(.pin-title) {
		font-weight: 700;
		font-size: var(--fs-md);
	}
	.map :global(.leaflet-control-zoom a) {
		width: 2.75rem;
		height: 2.75rem;
		line-height: 2.75rem;
		font-size: var(--fs-lg);
		background: var(--c-surface);
		color: var(--c-text);
	}
	/* Anche i controlli, i fumetti e le etichette di Leaflet con gli angoli vivi. */
	.map :global(:is(.leaflet-bar, .leaflet-bar a, .leaflet-control-layers, .leaflet-popup-content-wrapper, .leaflet-tooltip)) {
		border-radius: var(--radius);
	}
</style>
