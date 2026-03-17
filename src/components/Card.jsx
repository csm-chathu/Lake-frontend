import React from 'react';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl p-6 shadow-lg ${className}`}>{children}</div>
);

export default Card;
