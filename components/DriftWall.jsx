'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import './DriftWall.css';

const DEFAULT_ITEMS = Array.from({ length: 15 }, (_, i) => {
  const ids = [1015, 1025, 1039, 1043, 1044, 1050, 1062, 1069, 1074, 1080, 1084, 106, 110, 133, 164];
  return {
    image: `https://picsum.photos/id/${ids[i % ids.length]}/600/400`,
    title: `Tile ${i + 1}`
  };
});

// Read through `useSyncExternalStore` rather than set from an effect: the
// site's lint forbids setState in an effect body.
const REDUCED = '(prefers-reduced-motion: reduce)';
const subscribeReduced = cb => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const readReduced = () => window.matchMedia(REDUCED).matches;

const columnFactor = (index, variance) => {
  const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
  return 1 + variance * pseudo;
};

const DriftWall = ({
  items = DEFAULT_ITEMS,
  columns = /** @type {number | 'fill'} */ (5),
  tileWidth = 200,
  tileHeight = 132,
  gap = 18,
  radius = 14,
  tilt = 16,
  turn = -14,
  roll = 0,
  perspective = 1200,
  depth = 120,
  speed = 42,
  direction = 'up',
  variance = 0.45,
  parallax = 0.6,
  pauseOnHover = false,
  lift = 64,
  fade = 0.6,
  dim = 0.55,
  grayscale = false,
  overlayColor = '#060010',
  // The site's additions: load the photographs at once rather than as they
  // near the screen (the intro, where they are the whole point), and say
  // when the wall has come up.
  eager = false,
  onShown = /** @type {(() => void) | undefined} */ (undefined),
  className = '',
  style = undefined
}) => {
  const containerRef = useRef(null);
  const planeRef = useRef(null);
  const trackRefs = useRef([]);
  const rafRef = useRef(null);

  const offsetsRef = useRef([]);
  const velocitiesRef = useRef([]);
  const hoveredColRef = useRef(-1);
  const wallHoveredRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerDampedRef = useRef({ x: 0, y: 0 });
  const lastTsRef = useRef(null);

  const [containerHeight, setContainerHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeId, setActiveId] = useState(null);
  /* The site's addition: the wall stays hidden until every photograph it
     opens on has loaded, then fades in, so it never shows an empty frame.
     Julian: make sure all the photos are loaded before showing it. Capped,
     so a slow connection still gets the wall rather than nothing. */
  const [shown, setShown] = useState(false);
  /* Seen at least once. Lazy loading judges distance from the viewport by
     boxes the wall's tilt throws off, so tiles in plain view sat empty
     (measured: 31 of 96 loaded on the homepage's last screen). Once the
     wall is seen every tile loads. Julian: no empty slots. */
  const [seen, setSeen] = useState(false);
  const onShownRef = useRef(onShown);
  useEffect(() => {
    onShownRef.current = onShown;
  });
  useEffect(() => {
    let done = false;
    const show = () => {
      if (!done) {
        done = true;
        setShown(true);
        onShownRef.current?.();
      }
    };
    const cap = setTimeout(show, 5000);
    // A frame first, so the tiles are laid out and their places known.
    const raf = requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root) return show();
      // Photographs that loaded before React was listening (a server
      // render, a cached file) never fire `onLoad`: mark them here.
      for (const img of root.querySelectorAll('img')) {
        if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
      }
      const box = root.getBoundingClientRect();
      const inView = Array.from(root.querySelectorAll('img')).filter(img => {
        const r = img.getBoundingClientRect();
        // A tile swung behind the camera projects to a huge box: not in view.
        return (
          r.width > 0 &&
          r.width < box.width * 2 &&
          r.right > box.left &&
          r.left < box.right &&
          r.bottom > box.top &&
          r.top < box.bottom
        );
      });
      Promise.all(
        inView.map(img =>
          img.complete
            ? null
            : new Promise(r => {
                img.addEventListener('load', r, { once: true });
                img.addEventListener('error', r, { once: true });
              })
        )
      ).then(show);
    });
    return () => {
      clearTimeout(cap);
      cancelAnimationFrame(raf);
    };
  }, []);
  const activeIdRef = useRef(null);
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, () => false);

  /* `columns="fill"` (the site's addition): as many columns as it takes to
     cover the container, with room for the tilt and turn to swing the
     plane's edges in. When there are more columns than a few items each,
     every column runs through the items from its own starting point
     instead, so no column is one picture repeated. */
  const colCount =
    columns === 'fill'
      ? Math.max(5, Math.ceil((containerWidth * 1.5) / (tileWidth + gap)))
      : columns;

  const columnItems = useMemo(() => {
    if (items.length >= colCount * 4) {
      const cols = Array.from({ length: colCount }, () => []);
      items.forEach((item, i) => cols[i % colCount].push(item));
      return cols;
    }
    const run = Math.min(items.length, 6);
    return Array.from({ length: colCount }, (_, c) =>
      Array.from({ length: run }, (_, k) => items[(c * 7 + k * 5) % items.length])
    );
  }, [items, colCount]);

  const columnMeta = useMemo(() => {
    const unit = tileHeight + gap;
    return columnItems.map(col => {
      const copyHeight = Math.max(unit, col.length * unit);
      const copies = Math.max(2, Math.ceil((containerHeight * 1.6) / copyHeight) + 1);
      return { copyHeight, copies };
    });
  }, [columnItems, tileHeight, gap, containerHeight]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height || 600);
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const baseVelocities = useMemo(() => {
    const dirSign = direction === 'up' ? 1 : -1;
    return columnItems.map((_, c) => {
      const altSign = c % 2 === 0 ? 1 : -1;
      return speed * columnFactor(c, variance) * dirSign * altSign;
    });
  }, [columnItems, speed, direction, variance]);

  useEffect(() => {
    offsetsRef.current = columnMeta.map((meta, c) => meta.copyHeight * ((c * 0.37) % 1));
    velocitiesRef.current = columnItems.map(() => 0);
  }, [columnMeta, columnItems]);

  const applyPlaneTransform = useCallback(
    (px, py) => {
      const plane = planeRef.current;
      if (!plane) return;
      plane.style.transform =
        `translate(-50%, -50%) scale(1.18) ` +
        `rotateX(${tilt + py}deg) rotateY(${turn + px}deg) rotateZ(${roll}deg) ` +
        `translateZ(${-depth}px)`;
    },
    [tilt, turn, roll, depth]
  );

  useEffect(() => {
    const animate = ts => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, Math.max(0, ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const maxTilt = parallax * 8;
      const targetX = pointerRef.current.x * maxTilt;
      const targetY = -pointerRef.current.y * maxTilt;
      const damp = 1 - Math.exp(-dt / 0.12);
      pointerDampedRef.current.x += (targetX - pointerDampedRef.current.x) * damp;
      pointerDampedRef.current.y += (targetY - pointerDampedRef.current.y) * damp;
      applyPlaneTransform(pointerDampedRef.current.x, pointerDampedRef.current.y);

      if (!reduced) {
        for (let c = 0; c < trackRefs.current.length; c++) {
          const meta = columnMeta[c];
          if (!meta) continue;
          const paused = wallHoveredRef.current && pauseOnHover;
          const factor = paused || hoveredColRef.current === c ? 0 : 1;
          const target = baseVelocities[c] * factor;

          const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
          velocitiesRef.current[c] += (target - velocitiesRef.current[c]) * ease;
          let next = (offsetsRef.current[c] ?? 0) + velocitiesRef.current[c] * dt;
          next = ((next % meta.copyHeight) + meta.copyHeight) % meta.copyHeight;
          offsetsRef.current[c] = next;

          const el = trackRefs.current[c];
          if (el) el.style.transform = `translate3d(0, ${-next}px, 0)`;
        }
      } else {
        for (let c = 0; c < trackRefs.current.length; c++) {
          const el = trackRefs.current[c];
          const meta = columnMeta[c];
          if (el && meta) el.style.transform = `translate3d(0, ${-(offsetsRef.current[c] ?? 0)}px, 0)`;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    // The site's addition: only while it can be seen. A wall at the end of
    // a strip (the homepage's last screen) is mounted from the start and
    // would otherwise run the whole time somebody reads the screens before
    // it. Stopped, it picks up from where it stood.
    const start = () => {
      if (rafRef.current) return;
      lastTsRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    };
    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return stop();
      setSeen(true);
      start();
    });
    if (containerRef.current) io.observe(containerRef.current);
    else start();
    return () => {
      io.disconnect();
      stop();
      lastTsRef.current = null;
    };
  }, [baseVelocities, columnMeta, pauseOnHover, parallax, reduced, applyPlaneTransform]);

  const activate = useCallback((id, index) => {
    activeIdRef.current = id;
    hoveredColRef.current = index;
    setActiveId(id);
  }, []);
  const release = useCallback(() => {
    activeIdRef.current = null;
    hoveredColRef.current = -1;
    setActiveId(null);
  }, []);

  const handlePointerMove = useCallback(
    e => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (parallax > 0 && !reduced) {
        pointerRef.current = {
          x: (e.clientX - rect.left) / rect.width - 0.5,
          y: (e.clientY - rect.top) / rect.height - 0.5
        };
      }
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const tile = hit && hit.closest ? hit.closest('[data-tile-id]') : null;
      if (!tile) return;
      const id = tile.dataset.tileId;
      if (id === activeIdRef.current) return;
      activeIdRef.current = id;
      hoveredColRef.current = Number(tile.dataset.col);
      setActiveId(id);
    },
    [parallax, reduced]
  );

  const handlePointerLeaveWall = useCallback(() => {
    wallHoveredRef.current = false;
    pointerRef.current = { x: 0, y: 0 };
    release();
  }, [release]);

  const cssVars = useMemo(
    () => ({
      '--dw-tile-w': `${tileWidth}px`,
      '--dw-tile-h': `${tileHeight}px`,
      '--dw-gap': `${gap}px`,
      '--dw-radius': `${radius}px`,
      '--dw-perspective': `${perspective}px`,
      '--dw-lift': `${lift}px`,
      '--dw-dim': dim,
      '--dw-gray': grayscale ? 1 : 0,
      '--dw-overlay': overlayColor,
      '--dw-edge': `${Math.max(0, (1 - fade) * 100)}%`,
      ...style
    }),
    [tileWidth, tileHeight, gap, radius, perspective, lift, dim, grayscale, overlayColor, fade, style]
  );

  const renderTile = (item, id, colIndex) => {
    const inner = (
      <span className="drift-wall__inner">
        {/* eslint-disable-next-line @next/next/no-img-element -- the site passes loader-sized URLs */}
        <img src={item.image} alt={item.title ?? ''} loading={eager || seen ? 'eager' : 'lazy'} decoding="async" draggable={false} onLoad={e => e.currentTarget.classList.add('is-loaded')} />
        <span className="drift-wall__overlay" aria-hidden="true" />
      </span>
    );
    const commonProps = {
      className: `drift-wall__tile${activeId === id ? ' is-active' : ''}`,
      'data-tile-id': id,
      'data-col': colIndex,
      onFocus: () => activate(id, colIndex),
      onBlur: release
    };
    if (item.href) {
      return (
        // Only an outside link opens a new tab: one into the site stays in it.
        <a
          key={id}
          href={item.href}
          {...(/^https?:/.test(item.href) ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          {...commonProps}
        >
          {inner}
        </a>
      );
    }
    return (
      <div key={id} tabIndex={0} role="button" aria-label={item.title ?? 'tile'} {...commonProps}>
        {inner}
      </div>
    );
  };

  const rootClass = ['drift-wall', shown ? 'is-shown' : '', reduced ? 'drift-wall--reduced' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={rootClass}
      style={cssVars}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => {
        wallHoveredRef.current = true;
      }}
      onPointerLeave={handlePointerLeaveWall}
      role="group"
      aria-label="Drifting wall of tiles"
    >
      <div ref={planeRef} className="drift-wall__plane">
        {columnItems.map((col, c) => {
          const meta = columnMeta[c];
          const copies = Array.from({ length: meta.copies });
          return (
            <div className="drift-wall__col" key={`col-${c}`}>
              <div className="drift-wall__track" ref={el => (trackRefs.current[c] = el)}>
                {copies.map((_, copyIndex) =>
                  col.map((item, itemIndex) => renderTile(item, `${c}-${copyIndex}-${itemIndex}`, c))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DriftWall;
