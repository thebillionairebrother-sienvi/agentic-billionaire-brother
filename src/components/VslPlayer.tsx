import React from 'react';
import styles from './VslPlayer.module.css';

interface VslPlayerProps {
  videoId: string;
  badgeText?: string;
  badgeIcon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  caption?: string;
}

export default function VslPlayer({
  videoId,
  badgeText,
  badgeIcon,
  title,
  subtitle,
  caption,
}: VslPlayerProps) {
  return (
    <div className={styles.container}>
      {badgeText && (
        <div className={styles.badgeWrapper}>
          <div className={styles.systemChip}>
            {badgeIcon && <span className={styles.chipIcon}>{badgeIcon}</span>}
            <span>{badgeText}</span>
          </div>
        </div>
      )}

      {title && <h2 className={styles.title}>{title}</h2>}
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

      <div className={styles.videoWrapper}>
        <div className={styles.videoCard}>
          <iframe
            className={styles.iframe}
            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`}
            title="VSL Video Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>

      {caption && <p className={styles.caption}>{caption}</p>}
    </div>
  );
}
