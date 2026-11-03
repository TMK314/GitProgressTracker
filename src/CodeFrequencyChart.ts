export type CodeFrequencyPeriod = 'week' | 'day';

export interface DayWords {
    added: number;
    deleted: number;
}

interface Bucket extends DayWords {
    start: Date;
}

// Bars above this percentile of non-empty bars are cut, so a few bulk imports don't flatten the rest
const CAP_PERCENTILE = 0.95;

function localDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// One bucket per day or per week (weeks start on Sunday) from the first day with data to today, empty days included
export function buildBuckets(dailyMap: Map<string, DayWords>, period: CodeFrequencyPeriod, today: Date): Bucket[] {
    const keys = Array.from(dailyMap.keys()).sort();
    if (keys.length === 0) return [];

    const perWeek = period === 'week';
    const start = new Date(`${keys[0]}T00:00:00`);
    if (perWeek) start.setDate(start.getDate() - start.getDay());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const buckets: Bucket[] = [];
    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        if (!perWeek || day.getDay() === 0) buckets.push({ start: new Date(day), added: 0, deleted: 0 });
        const vals = dailyMap.get(localDateKey(day));
        if (!vals) continue;
        const bucket = buckets[buckets.length - 1]!;
        bucket.added += vals.added;
        bucket.deleted += vals.deleted;
    }
    return buckets;
}

export function percentileCap(values: number[], percentile: number): number {
    const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))]! : 0;
}

// Like GitHub "Code frequency": words added (up) and deleted (down) per week or per day
export function renderCodeFrequency(
    container: HTMLElement,
    dailyMap: Map<string, DayWords>,
    period: CodeFrequencyPeriod,
    onPeriodChange: (period: CodeFrequencyPeriod) => void,
): void {
    const perWeek = period === 'week';
    const buckets = buildBuckets(dailyMap, period, new Date());
    if (buckets.length === 0) return;

    const maxAdded = percentileCap(buckets.map(w => w.added), CAP_PERCENTILE);
    const maxDeleted = percentileCap(buckets.map(w => w.deleted), CAP_PERCENTILE);
    if (maxAdded + maxDeleted === 0) return;

    container.createEl('h4', { text: `Code frequency (words per ${period})` });
    const controls = container.createEl('div', { cls: 'heatmap-controls codefreq-controls' });
    const toggle = controls.createEl('button', { text: perWeek ? 'Per day' : 'Per week', cls: 'GitProgressTracker-btn' });
    toggle.onclick = () => onPeriodChange(perWeek ? 'day' : 'week');
    controls.createEl('span', { text: 'Added', cls: 'codefreq-legend codefreq-legend-added' });
    controls.createEl('span', { text: 'Deleted', cls: 'codefreq-legend codefreq-legend-deleted' });
    controls.createEl('span', { text: `Bars above the ${CAP_PERCENTILE * 100}th percentile are cut and marked at the end; hover shows the real value.`, cls: 'codefreq-note' });
    // Y axis stays fixed on the left; the plot scrolls when bars don't fit
    const frame = container.createEl('div', { cls: 'codefreq-frame' });
    const axisWidth = 48, padTop = 12, plotHeight = 280, padBottom = 36, padRight = 8;
    const height = padTop + plotHeight + padBottom;
    const axis = frame.createSvg('svg', { cls: 'GitProgressTracker-codefreq', attr: { width: axisWidth, height } });
    const wrapper = frame.createEl('div', { cls: 'GitProgressTracker-heatmap codefreq-scroll' });

    // Fill the available width; scroll only when bars would get thinner than 8px
    const available = (wrapper.clientWidth || 800) - padRight;
    const slot = Math.max(8, available / buckets.length);
    const barWidth = Math.max(slot * 0.75, slot - 2);
    const width = padRight + buckets.length * slot;
    // Zero line split proportionally, as GitHub does
    const zeroY = padTop + plotHeight * maxAdded / (maxAdded + maxDeleted);
    const scale = plotHeight / (maxAdded + maxDeleted);

    const svg = wrapper.createSvg('svg', { cls: 'GitProgressTracker-codefreq', attr: { width, height, viewBox: `0 0 ${width} ${height}` } });

    const text = (target: SVGElement, x: number, yPos: number, label: string, anchor: string) =>
        target.createSvg('text', { cls: 'codefreq-label', attr: { x, y: yPos, 'text-anchor': anchor } }).textContent = label;
    const short = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k` : n.toString();

    // Horizontal grid at half and full cap on both sides of zero
    for (const [value, sign] of [[maxAdded, -1], [maxDeleted, 1]] as const) {
        for (const f of [0.5, 1]) {
            if (value === 0) continue;
            const yPos = zeroY + sign * value * f * scale;
            svg.createSvg('line', { cls: 'codefreq-grid', attr: { x1: 0, x2: width - padRight, y1: yPos, y2: yPos } });
            text(axis, axisWidth - 6, yPos + 4, `${sign < 0 ? '+' : '-'}${short(Math.round(value * f))}`, 'end');
        }
    }
    text(axis, axisWidth - 6, zeroY + 4, '0', 'end');

    // Month labels: every month when there is room, otherwise every quarter.
    // The year goes on its own line below January (and the first month) so it never collides with the next month.
    const monthStep = slot * (perWeek ? 4.35 : 30.4) >= 40 ? 1 : 3;
    let lastMonth = -1;
    let labelEnd = -Infinity;
    buckets.forEach((bucket, i) => {
        const x = i * slot;
        const month = bucket.start.getMonth();
        if (month !== lastMonth && month % monthStep === 0) {
            svg.createSvg('line', { cls: 'codefreq-grid', attr: { x1: x, x2: x, y1: padTop, y2: padTop + plotHeight } });
            if (x + 2 >= labelEnd) {
                const label = svg.createSvg('text', { cls: 'codefreq-label', attr: { x: x + 2, y: padTop + plotHeight + 14, 'text-anchor': 'start' } });
                label.textContent = bucket.start.toLocaleString('default', { month: 'short' });
                labelEnd = x + 2 + label.getComputedTextLength() + 6;
            }
            if (month === 0 || lastMonth === -1) {
                text(svg, x + 2, padTop + plotHeight + 28, bucket.start.getFullYear().toString(), 'start');
            }
        }
        lastMonth = month;
    });

    const hover = svg.createSvg('rect', { cls: 'codefreq-hover', attr: { x: 0, y: padTop, width: slot, height: plotHeight } });
    buckets.forEach((bucket, i) => {
        const x = i * slot;
        if (bucket.added > 0) {
            const h = Math.max(Math.min(bucket.added, maxAdded) * scale, 1);
            svg.createSvg('rect', { cls: 'codefreq-added', attr: { x, y: zeroY - h, width: barWidth, height: h } });
            if (bucket.added > maxAdded) {
                svg.createSvg('rect', { cls: 'codefreq-clipped', attr: { x, y: zeroY - h, width: barWidth, height: 3 } });
            }
        }
        if (bucket.deleted > 0) {
            const h = Math.max(Math.min(bucket.deleted, maxDeleted) * scale, 1);
            svg.createSvg('rect', { cls: 'codefreq-deleted', attr: { x, y: zeroY, width: barWidth, height: h } });
            if (bucket.deleted > maxDeleted) {
                svg.createSvg('rect', { cls: 'codefreq-clipped', attr: { x, y: zeroY + h - 3, width: barWidth, height: 3 } });
            }
        }
    });
    svg.createSvg('line', { cls: 'codefreq-axis', attr: { x1: 0, x2: width - padRight, y1: zeroY, y2: zeroY } });

    attachTooltip({ svg, wrapper, hover, buckets, slot, top: padTop, perWeek });

    window.requestAnimationFrame(() => { wrapper.scrollLeft = wrapper.scrollWidth; });
}

// Instant tooltip for the column under the cursor (native SVG <title> waits about a second).
// `hover` is the highlight rect, drawn under the bars, that follows the cursor.
function attachTooltip({ svg, wrapper, hover, buckets, slot, top, perWeek }: {
    svg: SVGSVGElement;
    wrapper: HTMLElement;
    hover: SVGRectElement;
    buckets: Bucket[];
    slot: number;
    top: number;
    perWeek: boolean;
}): void {
    const tooltip = wrapper.createEl('div', { cls: 'codefreq-tooltip' });
    const hide = () => { svg.removeClass('is-hovering'); tooltip.hide(); };
    svg.addEventListener('mousemove', (e: MouseEvent) => {
        const i = Math.floor(e.offsetX / slot);
        const bucket = buckets[i];
        if (!bucket) { hide(); return; }
        hover.setAttr('x', i * slot);
        svg.addClass('is-hovering');
        tooltip.empty();
        tooltip.createDiv({ text: `${perWeek ? 'Week of ' : ''}${bucket.start.toLocaleDateString()}`, cls: 'codefreq-tooltip-date' });
        tooltip.createDiv({ text: `+${bucket.added.toLocaleString()} added`, cls: 'codefreq-tooltip-added' });
        tooltip.createDiv({ text: `-${bucket.deleted.toLocaleString()} deleted`, cls: 'codefreq-tooltip-deleted' });
        tooltip.show();
        // Keep it inside the visible part of the scroll area
        const left = i * slot + slot + 8;
        const flip = left + tooltip.offsetWidth > wrapper.scrollLeft + wrapper.clientWidth;
        tooltip.style.left = `${flip ? i * slot - tooltip.offsetWidth - 8 : left}px`;
        tooltip.style.top = `${top}px`;
    });
    svg.addEventListener('mouseleave', hide);
    tooltip.hide();
}
