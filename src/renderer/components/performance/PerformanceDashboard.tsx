import React, { useEffect, useState, useCallback } from 'react';
import { Task, PerformanceData, ChartDataPoint } from '../../types/performance';
import { PerformanceChart } from './PerformanceChart';
import { TaskManagement } from './TaskManagement';
import { ErrorBoundary, ErrorDisplay } from '../common/ErrorBoundary';
import { LoadingOverlay } from '../common/LoadingStates';
import './PerformanceDashboard.css';

export const PerformanceDashboard: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | undefined>(undefined);
  const [selectedMetric, setSelectedMetric] = useState<'processing_time' | 'token_count' | 'cost' | 'quality_rating'>('processing_time');
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      if (typeof window !== 'undefined' && window.electronAPI) {
        const taskList = await window.electronAPI.getTasks();
        setTasks(taskList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    }
  }, []);

  const fetchPerformanceData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (typeof window !== 'undefined' && window.electronAPI) {
        const data = await window.electronAPI.getPerformanceData();
        setPerformanceData(data);
        
        // Convert performance data to chart data points
        const chartPoints: ChartDataPoint[] = [];
        data.forEach(item => {
          // Add data points for different metrics
          chartPoints.push({
            timestamp: item.lastUsed,
            value: item.avgProcessingTime,
            modelId: item.modelId,
            modelName: item.modelName,
            metric: 'processing_time'
          });
          
          if (item.avgPromptTokens && item.avgCompletionTokens) {
            chartPoints.push({
              timestamp: item.lastUsed,
              value: item.avgPromptTokens + item.avgCompletionTokens,
              modelId: item.modelId,
              modelName: item.modelName,
              metric: 'token_count'
            });
          }
          
          if (item.avgCostPerRequest) {
            chartPoints.push({
              timestamp: item.lastUsed,
              value: item.avgCostPerRequest,
              modelId: item.modelId,
              modelName: item.modelName,
              metric: 'cost'
            });
          }
          
          // Calculate quality rating from feedback
          const totalFeedback = item.goodFeedback + item.badFeedback;
          if (totalFeedback > 0) {
            const qualityRating = (item.goodFeedback / totalFeedback) * 5;
            chartPoints.push({
              timestamp: item.lastUsed,
              value: qualityRating,
              modelId: item.modelId,
              modelName: item.modelName,
              metric: 'quality_rating'
            });
          }
        });
        
        setChartData(chartPoints);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData, selectedTask]);

  const handleTaskSelect = useCallback((taskId: string) => {
    setSelectedTask(taskId === selectedTask ? undefined : taskId);
  }, [selectedTask]);

  const handleTaskCreate = useCallback(async (name: string, description?: string) => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.createTask(name, description || '');
      await fetchTasks();
    }
  }, [fetchTasks]);

  const handleExportData = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.exportPerformanceData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    }
  }, []);

  if (error) {
    return (
      <ErrorBoundary>
        <div className="performance-dashboard">
          <ErrorDisplay
            error={error}
            title="Performance Dashboard Error"
            variant="card"
            onRetry={() => {
              fetchTasks();
              fetchPerformanceData();
            }}
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="performance-dashboard">
        <LoadingOverlay isLoading={isLoading} text="Loading performance data..." />
        
        <div className="dashboard-header">
          <h1>Performance Dashboard</h1>
          <div className="dashboard-actions">
            <button 
              onClick={handleExportData}
              className="export-button"
              disabled={performanceData.length === 0}
            >
              📊 Export Data
            </button>
          </div>
        </div>

        <TaskManagement
          tasks={tasks}
          selectedTaskId={selectedTask}
          isLoading={isLoading}
          error={error}
          onTaskSelect={handleTaskSelect}
          onTaskCreate={handleTaskCreate}
        />

        <div className="performance-section">
          <h2>Performance Visualization</h2>
          
          <PerformanceChart
            data={chartData}
            metric={selectedMetric}
            timeRange={timeRange}
            modelIds={selectedModels}
            isLoading={isLoading}
            error={error}
            onMetricChange={(metric) => setSelectedMetric(metric as any)}
            onTimeRangeChange={(range) => setTimeRange(range as any)}
            onModelFilter={setSelectedModels}
          />
        </div>

        <div className="performance-table-section">
          <h2>Model Performance Summary</h2>
          
          <div className="table-container">
            {performanceData.length === 0 ? (
              <div className="no-data">
                <p>No performance data available. Start using models to see metrics here.</p>
              </div>
            ) : (
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Requests</th>
                    <th>Avg. Time (ms)</th>
                    <th>Success Rate</th>
                    <th>Avg. Tokens</th>
                    <th>Quality Score</th>
                    <th>Cost per Request</th>
                    <th>Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.map((data) => {
                    const totalFeedback = data.goodFeedback + data.badFeedback;
                    const qualityScore = totalFeedback > 0 ? (data.goodFeedback / totalFeedback) * 5 : 0;
                    const avgTokens = (data.avgPromptTokens || 0) + (data.avgCompletionTokens || 0);
                    
                    return (
                      <tr key={data.modelId}>
                        <td className="model-name">{data.modelName}</td>
                        <td>{data.totalRequests}</td>
                        <td>{data.avgProcessingTime.toFixed(0)}</td>
                        <td className="success-rate">
                          <span className={`rate-badge ${data.successRate >= 0.9 ? 'good' : data.successRate >= 0.7 ? 'ok' : 'poor'}`}>
                            {(data.successRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td>{avgTokens.toFixed(0)}</td>
                        <td className="quality-score">
                          <span className={`score-badge ${qualityScore >= 4 ? 'excellent' : qualityScore >= 3 ? 'good' : qualityScore >= 2 ? 'ok' : 'poor'}`}>
                            {qualityScore.toFixed(1)}/5
                          </span>
                        </td>
                        <td>{data.avgCostPerRequest ? `$${data.avgCostPerRequest.toFixed(4)}` : 'N/A'}</td>
                        <td className="last-used">
                          {data.lastUsed.toLocaleDateString()} {data.lastUsed.toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};
