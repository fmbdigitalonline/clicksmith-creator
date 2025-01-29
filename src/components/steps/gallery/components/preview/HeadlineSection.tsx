import React from 'react';

interface HeadlineSectionProps {
  headline: string;
}

export const HeadlineSection = ({ headline }: HeadlineSectionProps) => {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-600">Headline:</p>
      <h3 className="text-lg font-semibold text-facebook">
        {headline}
      </h3>
    </div>
  );
};