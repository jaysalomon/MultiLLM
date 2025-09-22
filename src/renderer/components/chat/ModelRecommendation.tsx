import React, { useEffect, useState } from 'react';

interface ModelRecommendationProps {
  taskId?: string;
}

export const ModelRecommendation: React.FC<ModelRecommendationProps> = ({ taskId }) => {
  const [recommendedModel, setRecommendedModel] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchRecommendation = async () => {
      if (taskId) {
        const model = await window.electronAPI.getRecommendedModel(taskId);
        setRecommendedModel(model);
      }
    };
    fetchRecommendation();
  }, [taskId]);

  if (!recommendedModel) {
    return null;
  }

  return (
    <div className="model-recommendation">
      <span>Recommended Model:</span>
      <strong>{recommendedModel}</strong>
    </div>
  );
};
