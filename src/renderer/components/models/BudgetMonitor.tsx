import React, { useEffect, useState } from 'react';

interface BudgetStatus {
  budget: number;
  spending: number;
  remaining: number;
}

export const BudgetMonitor: React.FC = () => {
  const [status, setStatus] = useState<BudgetStatus | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Fetch budget status from the main process
    const fetchStatus = async () => {
      const budgetStatus = await window.electronAPI.getBudgetStatus();
      setStatus(budgetStatus);
    };
    fetchStatus();

    const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSuggestions = async () => {
    const newSuggestions = await window.electronAPI.getCostOptimizationSuggestions();
    setSuggestions(newSuggestions);
  };

  if (!status) {
    return <div>Loading budget...</div>;
  }

  return (
    <div className="budget-monitor">
      <h3>Budget Status</h3>
      <p>Budget: ${status.budget.toFixed(2)}</p>
      <p>Spending: ${status.spending.toFixed(2)}</p>
      <p>Remaining: ${status.remaining.toFixed(2)}</p>
      <button onClick={fetchSuggestions}>Get Cost-Saving Suggestions</button>
      {suggestions.length > 0 && (
        <div className="suggestions">
          <h4>Suggestions:</h4>
          <ul>
            {suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
