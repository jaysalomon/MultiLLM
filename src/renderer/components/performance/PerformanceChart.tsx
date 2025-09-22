import React, { useState, useMemo, useCallback } from 'react';
import { PerformanceChartProps, ChartDataPoint } from '../../types/performance';
import { ErrorBoundary, ErrorDisplay, EmptyState } from '../common/ErrorBoundary';
import { Spinner } from '../common/LoadingStates';
import './PerformanceChart.css';

/**
 * Performance chart component with SVG-based visualization
 * Requirements: 11.4
 */
export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  metric,
  timeRange,
  modelIds = [],
  isLoading = false,
  error,
  onMetricChange,
  onTimeRangeChange,
  onModelFilter
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set(modelIds));

  // Filter and process data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Filter by selected models if any
    let filteredData = data;
    if (selectedModels.size > 0) {
      filteredData = data.filter(point => selectedModels.has(point.modelId));
    }
    
    // Filter by metric
    filteredData = filteredData.filter(point => point.metric === metric);
    
    // Sort by timestamp
    return filteredData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [data, metric, selectedModels]);

  // Get unique models for legend
  const uniqueModels = useMemo(() => {
    const models = new Map<string, { id: string; name: string; color: string }>();
    data.forEach(point => {
      if (!models.has(point.modelId)) {
        models.set(point.modelId, {
          id: point.modelId,
          name: point.modelName,
          color: getModelColor(point.modelId)
        });
      }
    });
    return Array.from(models.values());
  }, [data]);

  // Calculate chart dimensions and scales
  const chartDimensions = {
    width: 800,
    height: 400,
    margin: { top: 20, right: 20, bottom: 60, left: 80 }
  };

  const innerWidth = chartDimensions.width - chartDimensions.margin.left - chartDimensions.margin.right;
  const innerHeight = chartDimensions.height - chartDimensions.margin.top - chartDimensions.margin.bottom;

  const { xScale, yScale, yDomain } = useMemo(() => {
    if (processedData.length === 0) {
      return {
        xScale: (value: number) => 0,
        yScale: (value: number) => 0,
        yDomain: [0, 1]
      };
    }

    const xDomain = [
      Math.min(...processedData.map(d => d.timestamp.getTime())),
      Math.max(...processedData.map(d => d.timestamp.getTime()))
    ];
    
    const yValues = processedData.map(d => d.value);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const yPadding = (yMax - yMin) * 0.1;
    const yDomain = [Math.max(0, yMin - yPadding), yMax + yPadding];

    return {
      xScale: (value: number) => ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerWidth,
      yScale: (value: number) => innerHeight - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerHeight,
      yDomain
    };
  }, [processedData, innerWidth, innerHeight]);

  // Generate path for each model
  const modelPaths = useMemo(() => {
    const pathsByModel = new Map<string, string>();
    
    uniqueModels.forEach(model => {
      const modelData = processedData.filter(d => d.modelId === model.id);
      if (modelData.length === 0) return;
      
      const pathData = modelData.map(d => 
        `${xScale(d.timestamp.getTime())},${yScale(d.value)}`
      ).join(' L ');
      
      pathsByModel.set(model.id, `M ${pathData}`);
    });
    
    return pathsByModel;
  }, [processedData, uniqueModels, xScale, yScale]);

  // Handle model selection
  const handleModelToggle = useCallback((modelId: string) => {
    setSelectedModels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(modelId)) {
        newSet.delete(modelId);
      } else {
        newSet.add(modelId);
      }
      
      if (onModelFilter) {
        onModelFilter(Array.from(newSet));
      }
      
      return newSet;
    });
  }, [onModelFilter]);

  // Format value based on metric
  const formatValue = useCallback((value: number) => {
    switch (metric) {
      case 'processing_time':
        return `${value.toFixed(0)}ms`;
      case 'token_count':
        return `${value.toFixed(0)} tokens`;
      case 'cost':
        return `$${value.toFixed(4)}`;
      case 'quality_rating':
        return `${value.toFixed(1)}/5`;
      default:
        return value.toFixed(2);
    }
  }, [metric]);

  // Get metric label
  const getMetricLabel = useCallback(() => {
    switch (metric) {
      case 'processing_time':
        return 'Processing Time (ms)';
      case 'token_count':
        return 'Token Count';
      case 'cost':
        return 'Cost ($)';
      case 'quality_rating':
        return 'Quality Rating';
      default:
        return 'Value';
    }
  }, [metric]);

  if (error) {
    return (
      <ErrorBoundary>
        <div className="performance-chart-container">
          <ErrorDisplay
            error={error}
            title="Chart Error"
            variant="card"
          />
        </div>
      </ErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <div className="performance-chart-container">
        <div className="chart-loading">
          <Spinner size="large" text="Loading chart data..." />
        </div>
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <ErrorBoundary>
        <div className="performance-chart-container">
          <div className="chart-controls">
            <div className="metric-selector">
              <label htmlFor="metric-select">Metric:</label>
              <select
                id="metric-select"
                value={metric}
                onChange={(e) => onMetricChange?.(e.target.value)}
              >
                <option value="processing_time">Processing Time</option>
                <option value="token_count">Token Count</option>
                <option value="cost">Cost</option>
                <option value="quality_rating">Quality Rating</option>
              </select>
            </div>
            
            <div className="time-range-selector">
              <label htmlFor="time-range-select">Time Range:</label>
              <select
                id="time-range-select"
                value={timeRange}
                onChange={(e) => onTimeRangeChange?.(e.target.value)}
              >
                <option value="hour">Last Hour</option>
                <option value="day">Last Day</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
              </select>
            </div>
          </div>
          
          <EmptyState
            title="No Data Available"
            description={`No ${getMetricLabel().toLowerCase()} data found for the selected time range and models.`}
            icon="📊"
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="performance-chart-container">
        <div className="chart-header">
          <h3 className="chart-title">{getMetricLabel()} Over Time</h3>
          
          <div className="chart-controls">
            <div className="metric-selector">
              <label htmlFor="metric-select">Metric:</label>
              <select
                id="metric-select"
                value={metric}
                onChange={(e) => onMetricChange?.(e.target.value)}
              >
                <option value="processing_time">Processing Time</option>
                <option value="token_count">Token Count</option>
                <option value="cost">Cost</option>
                <option value="quality_rating">Quality Rating</option>
              </select>
            </div>
            
            <div className="time-range-selector">
              <label htmlFor="time-range-select">Time Range:</label>
              <select
                id="time-range-select"
                value={timeRange}
                onChange={(e) => onTimeRangeChange?.(e.target.value)}
              >
                <option value="hour">Last Hour</option>
                <option value="day">Last Day</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
              </select>
            </div>
          </div>
        </div>

        <div className="chart-content">
          <div className="chart-legend">
            {uniqueModels.map(model => (
              <div
                key={model.id}
                className={`legend-item ${selectedModels.size === 0 || selectedModels.has(model.id) ? 'active' : 'inactive'}`}
                onClick={() => handleModelToggle(model.id)}
              >
                <div
                  className="legend-color"
                  style={{ backgroundColor: model.color }}
                />
                <span className="legend-label">{model.name}</span>
              </div>
            ))}
          </div>

          <div className="chart-svg-container">
            <svg
              width={chartDimensions.width}
              height={chartDimensions.height}
              className="performance-chart-svg"
            >
              {/* Chart background */}
              <rect
                x={chartDimensions.margin.left}
                y={chartDimensions.margin.top}
                width={innerWidth}
                height={innerHeight}
                fill="var(--color-background-secondary, #f8f9fa)"
                stroke="var(--color-border, #dee2e6)"
              />

              {/* Y-axis grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                const y = chartDimensions.margin.top + ratio * innerHeight;
                const value = yDomain[1] - ratio * (yDomain[1] - yDomain[0]);
                return (
                  <g key={ratio}>
                    <line
                      x1={chartDimensions.margin.left}
                      y1={y}
                      x2={chartDimensions.margin.left + innerWidth}
                      y2={y}
                      stroke="var(--color-border-light, #e9ecef)"
                      strokeDasharray="2,2"
                    />
                    <text
                      x={chartDimensions.margin.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="12"
                      fill="var(--color-text-secondary, #6c757d)"
                    >
                      {formatValue(value)}
                    </text>
                  </g>
                );
              })}

              {/* X-axis */}
              <line
                x1={chartDimensions.margin.left}
                y1={chartDimensions.margin.top + innerHeight}
                x2={chartDimensions.margin.left + innerWidth}
                y2={chartDimensions.margin.top + innerHeight}
                stroke="var(--color-border, #dee2e6)"
              />

              {/* Y-axis */}
              <line
                x1={chartDimensions.margin.left}
                y1={chartDimensions.margin.top}
                x2={chartDimensions.margin.left}
                y2={chartDimensions.margin.top + innerHeight}
                stroke="var(--color-border, #dee2e6)"
              />

              {/* Data lines */}
              {uniqueModels.map(model => {
                const path = modelPaths.get(model.id);
                const isVisible = selectedModels.size === 0 || selectedModels.has(model.id);
                
                if (!path || !isVisible) return null;
                
                return (
                  <path
                    key={model.id}
                    d={path}
                    fill="none"
                    stroke={model.color}
                    strokeWidth="2"
                    opacity={0.8}
                  />
                );
              })}

              {/* Data points */}
              {processedData.map((point, index) => {
                const isVisible = selectedModels.size === 0 || selectedModels.has(point.modelId);
                if (!isVisible) return null;
                
                const x = chartDimensions.margin.left + xScale(point.timestamp.getTime());
                const y = chartDimensions.margin.top + yScale(point.value);
                const color = getModelColor(point.modelId);
                
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="4"
                    fill={color}
                    stroke="white"
                    strokeWidth="2"
                    className="chart-point"
                    onMouseEnter={() => setHoveredPoint(point)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}

              {/* Tooltip */}
              {hoveredPoint && (
                <g className="chart-tooltip">
                  <rect
                    x={chartDimensions.margin.left + xScale(hoveredPoint.timestamp.getTime()) + 10}
                    y={chartDimensions.margin.top + yScale(hoveredPoint.value) - 30}
                    width="120"
                    height="50"
                    fill="var(--color-background-primary, white)"
                    stroke="var(--color-border, #dee2e6)"
                    rx="4"
                  />
                  <text
                    x={chartDimensions.margin.left + xScale(hoveredPoint.timestamp.getTime()) + 15}
                    y={chartDimensions.margin.top + yScale(hoveredPoint.value) - 15}
                    fontSize="12"
                    fill="var(--color-text-primary, #212529)"
                  >
                    {hoveredPoint.modelName}
                  </text>
                  <text
                    x={chartDimensions.margin.left + xScale(hoveredPoint.timestamp.getTime()) + 15}
                    y={chartDimensions.margin.top + yScale(hoveredPoint.value) - 2}
                    fontSize="12"
                    fill="var(--color-text-secondary, #6c757d)"
                  >
                    {formatValue(hoveredPoint.value)}
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Helper function to generate consistent colors for models
function getModelColor(modelId: string): string {
  const colors = [
    '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
    '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6c757d'
  ];
  
  let hash = 0;
  for (let i = 0; i < modelId.length; i++) {
    hash = modelId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}
