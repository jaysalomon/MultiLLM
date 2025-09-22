import React from 'react';

interface MessageFeedbackProps {
  messageId: string;
  onFeedback: (feedback: 'good' | 'bad') => void;
}

export const MessageFeedback: React.FC<MessageFeedbackProps> = ({ messageId, onFeedback }) => {
  return (
    <div className="message-feedback">
      <button onClick={() => onFeedback('good')}>👍</button>
      <button onClick={() => onFeedback('bad')}>👎</button>
    </div>
  );
};
