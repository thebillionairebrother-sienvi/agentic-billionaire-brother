'use client';

import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

const PHRASES = [
  "Business Strategy That Ships",
  "More Action, Less Yapping",
  "Derek thinks your roadmap is cute",
  "Stop planning, start shipping",
  "Your Notion board won't save you",
  "Touch grass, then ship code"
];

interface RotatingTextBadgeProps {
  className?: string;
}

export default function RotatingTextBadge({ className = '' }: RotatingTextBadgeProps) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % PHRASES.length);
        setFade(true);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={className}>
      <Zap size={14} />
      <span
        style={{
          transition: 'opacity 0.3s ease-in-out',
          opacity: fade ? 1 : 0
        }}
      >
        {PHRASES[index]}
      </span>
    </div>
  );
}
