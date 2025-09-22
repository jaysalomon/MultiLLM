import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PerformanceChart } from '../PerformanceChart';
import { ChartDataPoint } from '../../../types/performance';

// Mock CSS imports
vi.mock('../PerformanceChart.css', () => ({}));
vi.mock('../../common/ErrorBoundary.css', () => ({}));
vi.mock('../../common/LoadingStates.css', () => ({}));

describe('PerformanceChart', () => {
  const mockData: ChartDataPoint[] = [
    {
      timestamp: new Date('2024-01-01T10:00:00Z'),
      value: 1500,
      modelId: 'model-1',
      modelName: 'GPT-4',
      metric: 'processing_time'
    },
    {
      timestamp: new Date('2024-01-01T11:00:00Z'),
      value: 1200,
      modelId: 'model-1',
      modelName: 'GPT-4',
      metric: 'processing_time'
    }
  ];

  it('renders chart with data', () => {
    render(
      <PerformanceChart
        data={mockData}
        metric="processing_time"
        timeRange="day"
      />
    );

    expect(screen.getByText('Processing Time (ms) Over Time')).toBeInTheDocument();
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <PerformanceChart
        data={[]}
        metric="processing_time"
        timeRange="day"
        isLoading={true}
      />
    );

    expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <PerformanceChart
        data={[]}
        metric="processing_time"
        timeRange="day"
        error="Failed to load data"
      />
    );

    expect(screen.getByText('Chart Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(
      <PerformanceChart
        data={[]}
        metric="processing_time"
        timeRange="day"
      />
    );

    expect(screen.getByText('No Data Available')).toBeInTheDocument();
  });
});