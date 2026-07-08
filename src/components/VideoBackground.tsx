'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import styles from './VideoBackground.module.css';

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { scrollY, scrollYProgress } = useScroll();
  const [isLoaded, setIsLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Keep track of target scroll progress and animation frame loop state
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Parallax effects on the video element for layered 3D depth
  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "-8%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.06, 1.0]);
  const opacity = useTransform(scrollYProgress, [0, 0.85, 1], [0.65, 0.55, 0.45]);

  // Detect prefers-reduced-motion on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Update target progress when scrolling
  useEffect(() => {
    if (prefersReducedMotion) return;

    const unsubscribe = scrollYProgress.on('change', (latest) => {
      targetProgressRef.current = latest;
      
      // Start the interpolation loop if it isn't running
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(interpolateVideoPlayback);
      }
    });

    return () => {
      unsubscribe();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [scrollYProgress, prefersReducedMotion, isLoaded]);

  // Interpolation loop to smooth scroll-to-video playback mapping
  const interpolateVideoPlayback = () => {
    const video = videoRef.current;
    if (!video || !video.duration || isNaN(video.duration)) {
      animationFrameRef.current = requestAnimationFrame(interpolateVideoPlayback);
      return;
    }

    const target = targetProgressRef.current;
    const current = currentProgressRef.current;
    
    // Easing factor (lerp) for smooth seeking. Adjust for responsiveness vs smoothing.
    const ease = 0.08;
    const nextProgress = current + (target - current) * ease;
    
    // Check if we are close enough to the target to snap and stop the loop
    if (Math.abs(target - nextProgress) < 0.0002) {
      currentProgressRef.current = target;
      video.currentTime = target * video.duration;
      animationFrameRef.current = null; // Pause loop
      return;
    }

    currentProgressRef.current = nextProgress;
    video.currentTime = nextProgress * video.duration;

    // Continue the interpolation loop
    animationFrameRef.current = requestAnimationFrame(interpolateVideoPlayback);
  };

  // Handle metadata loaded event
  const handleLoadedMetadata = () => {
    setIsLoaded(true);
    const video = videoRef.current;
    if (video) {
      video.pause();
      // Initialize video to start frame
      video.currentTime = 0;
    }
  };

  return (
    <motion.div 
      className={styles.videoBackgroundContainer}
      style={{ y: prefersReducedMotion ? 0 : scrollY }}
    >
      <motion.video
        ref={videoRef}
        onLoadedMetadata={handleLoadedMetadata}
        className={styles.videoElement}
        style={{
          y: prefersReducedMotion ? 0 : videoY,
          scale: prefersReducedMotion ? 1 : scale,
          opacity: prefersReducedMotion ? 0.5 : opacity,
        }}
        src="/scroll-background.mp4"
        poster="/scroll-background-poster.jpg"
        muted
        playsInline
        preload="auto"
      />
      <div className={styles.videoOverlay} />
    </motion.div>
  );
}
