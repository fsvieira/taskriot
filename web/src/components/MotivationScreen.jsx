import React, { useState } from 'react';
import './MotivationScreen.css';

const MotivationScreen = ({ onClose }) => {
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    setPressed(true);
    setTimeout(() => {
      onClose();
    }, 200); // Duration of the press animation
  };

  return (
    <div className="motivation-screen">
      <div className="motivation-background"></div>
      <button
        className={`motivation-button ${pressed ? 'pressed' : ''}`}
        onClick={handleClick}
      >
        <img src="/start-clean.png" alt="Start Clean" />
      </button>
    </div>
  );
};

export default MotivationScreen;