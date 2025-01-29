import React from 'react';

interface PrimaryTextProps {
  description: string;
}

export const PrimaryText = ({ description }: PrimaryTextProps) => {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-600">Primary Text:</p>
      <p className="text-gray-800">{description}</p>
    </div>
  );
};