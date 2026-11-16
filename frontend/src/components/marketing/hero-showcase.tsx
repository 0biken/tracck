'use client';

import { GridScan } from '@/components/ui/grid-scan';
import styles from './hero-showcase.module.css';

const wallImages = {
  left: [
    '/hero/x-post-1.jpg',
    '/hero/x-post-chidi.jpg',
    '/hero/x-post-hashing.jpg',
    '/hero/x-post-siwes.jpg',
  ],
  right: [
    '/hero/x-post-2.jpg',
    '/hero/github-pr.jpg',
    '/hero/x-post-3.jpg',
    '/hero/github-heatmap.jpg',
  ],
  ceiling: [
    '/hero/architecture.jpg', '/hero/devto-article.jpg', '/hero/github-heatmap.jpg', '/hero/x-post-3.jpg',
  ],
  floor: [
    '/hero/portfolio-1.jpg', '/hero/case-study.jpg', '/hero/github-pr.jpg', '/hero/x-post-chidi.jpg',
  ],
};

export function HeroShowcase() {
  return (
    <div className={styles.showcase} role="img" aria-label="An example resume on the back wall of a grid room, surrounded by proof-of-work posts and projects">
      <GridScan
        linesColor="#4d4757" scanColor="#3FA872" cells={2} depthColumns={2} depth={1.5}
        scanDuration={3.3} scanDelay={1.6} clickEffect="ping" lineThickness={2.1}
        lineStyle="solid" depthFade={0.6} shading={0.7} reflection={0.35} points
        scanDirection="forward" scanWidth={1} trail={0.5} glow={0.7} parallax={1.3}
        autoScan interactive enableWebcam={false} showPreview={false} intro lightMode={false}
        wallImages={wallImages} backImage="/hero/resume-clean.jpg"
      />
    </div>
  );
}

export default HeroShowcase;
