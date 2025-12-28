/**
 * Chart Drawing Manager
 * 
 * Manages interactive drawing tools for lightweight-charts v5.
 * Supports horizontal lines, trendlines, rays, and more.
 */

import { LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, IPriceLine } from 'lightweight-charts';

export type DrawingTool = 'cursor' | 'crosshair' | 'horizontal' | 'trendline' | 'ray' | 'rectangle';

export interface DrawingPoint {
    time: Time;
    price: number;
}

export interface Drawing {
    id: string;
    type: DrawingTool;
    points: DrawingPoint[];
    color: string;
    lineWidth: number;
    lineStyle: number; // 0=solid, 1=dotted, 2=dashed
    seriesRef?: ISeriesApi<'Line'>;
    priceLineRef?: IPriceLine;
    label?: string;
}

export interface DrawingManagerOptions {
    defaultColor?: string;
    defaultLineWidth?: number;
    defaultLineStyle?: number;
    onDrawingComplete?: (drawing: Drawing) => void;
    onDrawingSelect?: (drawing: Drawing | null) => void;
}

export class DrawingManager {
    private chart: IChartApi;
    private mainSeries: ISeriesApi<'Candlestick'>;
    private drawings: Map<string, Drawing> = new Map();
    private activeDrawing: Drawing | null = null;
    private activeTool: DrawingTool = 'cursor';
    private selectedDrawing: Drawing | null = null;
    private options: DrawingManagerOptions;
    private previewSeries: ISeriesApi<'Line'> | null = null;

    constructor(
        chart: IChartApi,
        mainSeries: ISeriesApi<'Candlestick'>,
        options: DrawingManagerOptions = {}
    ) {
        this.chart = chart;
        this.mainSeries = mainSeries;
        this.options = {
            defaultColor: '#00D4AA',
            defaultLineWidth: 2,
            defaultLineStyle: 0,
            ...options,
        };
    }

    /**
     * Set the active drawing tool
     */
    setTool(tool: DrawingTool): void {
        if (this.activeDrawing) {
            this.cancelDrawing();
        }

        this.activeTool = tool;

        const chartElement = this.chart.chartElement();
        if (chartElement) {
            chartElement.style.cursor = tool === 'cursor' ? 'default' : 'crosshair';
        }
    }

    getTool(): DrawingTool {
        return this.activeTool;
    }

    /**
     * Handle chart click event
     */
    handleClick(param: { time?: Time; point?: { x: number; y: number } }): void {
        if (this.activeTool === 'cursor' || this.activeTool === 'crosshair') {
            return;
        }

        if (!param.time || !param.point) return;

        const price = this.mainSeries.coordinateToPrice(param.point.y);
        if (price === null) return;

        const point: DrawingPoint = { time: param.time, price };

        if (this.activeTool === 'horizontal') {
            this.createHorizontalLine(price);
        } else if (this.activeTool === 'trendline' || this.activeTool === 'ray') {
            this.handleTrendlineClick(point);
        }
    }

    /**
     * Handle crosshair move for preview while drawing
     */
    handleCrosshairMove(param: { time?: Time; point?: { x: number; y: number } }): void {
        if (!this.activeDrawing || !param.point || !param.time) return;

        const price = this.mainSeries.coordinateToPrice(param.point.y);
        if (price === null) return;

        this.updatePreview({ time: param.time, price });
    }

    /**
     * Create a horizontal line at the specified price
     */
    private createHorizontalLine(price: number): Drawing {
        const drawing: Drawing = {
            id: this.generateId(),
            type: 'horizontal',
            points: [{ time: 0 as Time, price }],
            color: this.options.defaultColor!,
            lineWidth: this.options.defaultLineWidth!,
            lineStyle: this.options.defaultLineStyle!,
            label: `$${price.toFixed(6)}`,
        };

        const priceLine = this.mainSeries.createPriceLine({
            price: price,
            color: drawing.color,
            lineWidth: drawing.lineWidth,
            lineStyle: drawing.lineStyle,
            axisLabelVisible: true,
            title: '',
        });

        drawing.priceLineRef = priceLine;
        this.drawings.set(drawing.id, drawing);

        this.options.onDrawingComplete?.(drawing);
        this.setTool('cursor');

        return drawing;
    }

    /**
     * Handle clicks for trendline/ray drawing
     */
    private handleTrendlineClick(point: DrawingPoint): void {
        if (!this.activeDrawing) {
            // First click - start the drawing
            this.activeDrawing = {
                id: this.generateId(),
                type: this.activeTool,
                points: [point],
                color: this.options.defaultColor!,
                lineWidth: this.options.defaultLineWidth!,
                lineStyle: this.options.defaultLineStyle!,
            };

            // Create preview series using v5 API
            this.previewSeries = this.chart.addSeries(LineSeries, {
                color: this.activeDrawing.color,
                lineWidth: 1,
                lineStyle: 2,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false,
            });

            this.previewSeries.setData([{ time: point.time, value: point.price }]);
        } else {
            // Second click - complete the drawing
            this.activeDrawing.points.push(point);
            this.completeDrawing();
        }
    }

    /**
     * Update preview line while drawing
     */
    private updatePreview(endPoint: DrawingPoint): void {
        if (!this.activeDrawing || !this.previewSeries) return;

        const startPoint = this.activeDrawing.points[0];

        this.previewSeries.setData([
            { time: startPoint.time, value: startPoint.price },
            { time: endPoint.time, value: endPoint.price },
        ]);
    }

    /**
     * Complete the current drawing
     */
    private completeDrawing(): void {
        if (!this.activeDrawing) return;

        if (this.previewSeries) {
            this.chart.removeSeries(this.previewSeries);
            this.previewSeries = null;
        }

        // Create the actual line series using v5 API
        const lineSeries = this.chart.addSeries(LineSeries, {
            color: this.activeDrawing.color,
            lineWidth: this.activeDrawing.lineWidth,
            lineStyle: this.activeDrawing.lineStyle,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });

        const data = this.activeDrawing.points.map(p => ({
            time: p.time,
            value: p.price,
        }));

        // For rays, extend to make it look like it continues
        if (this.activeDrawing.type === 'ray' && data.length >= 2) {
            const t1 = data[0].time as number;
            const t2 = data[1].time as number;
            const p1 = data[0].value;
            const p2 = data[1].value;
            const slope = (p2 - p1) / (t2 - t1);

            const extendedTime = t2 + (t2 - t1) * 10;
            const extendedPrice = p2 + slope * (extendedTime - t2);
            data.push({ time: extendedTime as Time, value: extendedPrice });
        }

        lineSeries.setData(data);
        this.activeDrawing.seriesRef = lineSeries;

        this.drawings.set(this.activeDrawing.id, this.activeDrawing);
        this.options.onDrawingComplete?.(this.activeDrawing);

        this.activeDrawing = null;
        this.setTool('cursor');
    }

    /**
     * Cancel current drawing in progress
     */
    cancelDrawing(): void {
        if (this.previewSeries) {
            this.chart.removeSeries(this.previewSeries);
            this.previewSeries = null;
        }
        this.activeDrawing = null;
    }

    /**
     * Remove a drawing by ID
     */
    removeDrawing(id: string): boolean {
        const drawing = this.drawings.get(id);
        if (!drawing) return false;

        if (drawing.seriesRef) {
            this.chart.removeSeries(drawing.seriesRef);
        }
        if (drawing.priceLineRef) {
            this.mainSeries.removePriceLine(drawing.priceLineRef);
        }

        this.drawings.delete(id);
        return true;
    }

    /**
     * Remove all drawings
     */
    clearAllDrawings(): void {
        this.drawings.forEach((drawing) => {
            if (drawing.seriesRef) {
                this.chart.removeSeries(drawing.seriesRef);
            }
            if (drawing.priceLineRef) {
                this.mainSeries.removePriceLine(drawing.priceLineRef);
            }
        });
        this.drawings.clear();
        this.cancelDrawing();
    }

    /**
     * Get all drawings
     */
    getAllDrawings(): Drawing[] {
        return Array.from(this.drawings.values());
    }

    /**
     * Get drawings as serializable data (for persistence)
     */
    toJSON(): Omit<Drawing, 'seriesRef' | 'priceLineRef'>[] {
        return this.getAllDrawings().map(d => ({
            id: d.id,
            type: d.type,
            points: d.points,
            color: d.color,
            lineWidth: d.lineWidth,
            lineStyle: d.lineStyle,
            label: d.label,
        }));
    }

    /**
     * Load drawings from serialized data
     */
    fromJSON(data: Omit<Drawing, 'seriesRef' | 'priceLineRef'>[]): void {
        this.clearAllDrawings();

        for (const item of data) {
            if (item.type === 'horizontal' && item.points[0]) {
                const drawing = this.createHorizontalLineFromData(item);
                this.drawings.set(drawing.id, drawing);
            } else if ((item.type === 'trendline' || item.type === 'ray') && item.points.length >= 2) {
                const drawing = this.createTrendlineFromData(item);
                this.drawings.set(drawing.id, drawing);
            }
        }
    }

    private createHorizontalLineFromData(data: Omit<Drawing, 'seriesRef' | 'priceLineRef'>): Drawing {
        const price = data.points[0].price;
        const priceLine = this.mainSeries.createPriceLine({
            price: price,
            color: data.color,
            lineWidth: data.lineWidth,
            lineStyle: data.lineStyle,
            axisLabelVisible: true,
            title: '',
        });

        return { ...data, priceLineRef: priceLine };
    }

    private createTrendlineFromData(data: Omit<Drawing, 'seriesRef' | 'priceLineRef'>): Drawing {
        // Use v5 API
        const lineSeries = this.chart.addSeries(LineSeries, {
            color: data.color,
            lineWidth: data.lineWidth,
            lineStyle: data.lineStyle,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
        });

        lineSeries.setData(data.points.map(p => ({ time: p.time, value: p.price })));

        return { ...data, seriesRef: lineSeries };
    }

    private generateId(): string {
        return `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update drawing color
     */
    setDrawingColor(id: string, color: string): boolean {
        const drawing = this.drawings.get(id);
        if (!drawing) return false;

        drawing.color = color;

        if (drawing.priceLineRef) {
            this.mainSeries.removePriceLine(drawing.priceLineRef);
            drawing.priceLineRef = this.mainSeries.createPriceLine({
                price: drawing.points[0].price,
                color: color,
                lineWidth: drawing.lineWidth,
                lineStyle: drawing.lineStyle,
                axisLabelVisible: true,
                title: '',
            });
        }
        if (drawing.seriesRef) {
            drawing.seriesRef.applyOptions({ color });
        }

        return true;
    }

    /**
     * Check if currently in drawing mode
     */
    isDrawing(): boolean {
        return this.activeDrawing !== null;
    }

    /**
     * Set default color for new drawings
     */
    setDefaultColor(color: string): void {
        this.options.defaultColor = color;
    }

    /**
     * Get selected drawing
     */
    getSelectedDrawing(): Drawing | null {
        return this.selectedDrawing;
    }
}

/**
 * Create a drawing manager instance
 */
export function createDrawingManager(
    chart: IChartApi,
    mainSeries: ISeriesApi<'Candlestick'>,
    options?: DrawingManagerOptions
): DrawingManager {
    return new DrawingManager(chart, mainSeries, options);
}
