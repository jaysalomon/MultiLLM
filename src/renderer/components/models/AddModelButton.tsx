import React from 'react';
import './AddModelButton.css';

export interface AddModelButtonProps {
  onClick: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'outline';
}

export const AddModelButton: React.FC<AddModelButtonProps> = ({
  onClick,
  disabled = false,
  size = 'medium',
  variant = 'primary'
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onClick();
      }
    }
  };

  return (
    <button
      className={`add-model-button add-model-button--${size} add-model-button--${variant}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      title="Add a new model to the conversation"
    >
      <span className="add-model-button__icon">+</span>
      <span className="add-model-button__text">Add Model</span>
    </button>
  );
};

export default AddModelButton;