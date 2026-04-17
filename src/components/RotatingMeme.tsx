'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

// Replace these with the actual filenames you add to public/memes/
const MEME_FILES = [
  "/memes/meme1.jpg",
  "/memes/meme2.jpg",
  "/memes/meme3.gif",
  "/memes/meme4.gif"
];

export default function RotatingMeme() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % MEME_FILES.length);
    }, 4000); // Change image every 4 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'relative', width: '375px', height: '225px' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.5, rotate: -15, y: 50 }}
          animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, rotate: 10, y: -20 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          {/* We use unoptimized for dev purposes if the images are missing to avoid aggressive errors */}
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Image
              src={MEME_FILES[index]}
              alt="Rotating business meme"
              fill
              style={{ objectFit: 'contain' }}
              sizes="375px"
              priority
              unoptimized
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
