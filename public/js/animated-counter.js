/**
 * AnimatedCounter - Smooth Rolling Digit Counter
 * Replicates the Framer Motion wheel spring counter in zero-dependency Vanilla JavaScript.
 */
(function (global) {
  'use strict';

  const FACES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const WHEEL = [...FACES, 0];
  const WHEEL_LEN = WHEEL.length;
  const BOUNCE = 0.18;
  const MAX_DECIMALS = 15;
  const MAX_PAD = 24;
  const MIN_DURATION = 0.01;
  const MAX_DURATION = 60;

  const mod = (n, m) => ((n % m) + m) % m;
  const clamp = (n, low, high) =>
    Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
  const isDigit = (char) => char >= '0' && char <= '9';

  const EVERY_THREE = /\B(?=(\d{3})+(?!\d))/g;
  const EVERY_TWO = /\B(?=(\d{2})+(?!\d))/g;

  function group(whole, separator, grouping) {
    if (!separator) return whole;
    if (grouping !== 'indian') return whole.replace(EVERY_THREE, separator);
    const head = whole.slice(0, -3);
    if (!head) return whole;
    return `${head.replace(EVERY_TWO, separator)}${separator}${whole.slice(-3)}`;
  }

  function measure(value, decimals, padStart, duration) {
    const amount = Number.isFinite(value) ? value : 0;
    const places = clamp(Math.trunc(decimals), 0, MAX_DECIMALS);
    const pad = clamp(Math.trunc(padStart), 1, MAX_PAD);
    const scaled = Math.min(
      Number.MAX_SAFE_INTEGER,
      Math.round(Math.abs(amount) * 10 ** places)
    );
    return {
      amount,
      scaled,
      places,
      pace: clamp(duration, MIN_DURATION, MAX_DURATION),
      width: Math.max(String(scaled).length, places + pad),
    };
  }

  function format(shape, separator, decimalSeparator, grouping) {
    const raw = String(shape.scaled).padStart(shape.width, '0');
    const whole = group(
      raw.slice(0, raw.length - shape.places) || '0',
      separator,
      grouping
    );
    return shape.places
      ? `${whole}${decimalSeparator}${raw.slice(raw.length - shape.places)}`
      : whole;
  }

  function toCells(chars, width) {
    const cells = [];
    let seen = 0;
    let run = 0;
    for (const char of chars) {
      if (isDigit(char)) {
        run = 0;
        cells.push({ kind: 'digit', key: width - seen++, digit: Number(char) });
      } else {
        cells.push({ kind: 'mark', key: `mark-${width - seen}-${run++}`, char });
      }
    }
    return cells;
  }

  function prefersReducedMotion() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  class DigitColumn {
    constructor(key, initialDigit) {
      this.key = key;
      this.currentPos = initialDigit;
      this.goal = initialDigit;
      this.animId = null;

      // DOM elements
      this.el = document.createElement('span');
      this.el.className = 'animated-counter-digit';
      this.el.setAttribute('data-slot', 'animated-counter-digit');
      this.el.setAttribute('data-key', String(key));

      // Sizers for uniform column width
      FACES.forEach((face) => {
        const sizer = document.createElement('span');
        sizer.className = 'animated-counter-sizer';
        sizer.setAttribute('aria-hidden', 'true');
        sizer.textContent = String(face);
        this.el.appendChild(sizer);
      });

      // Stack
      this.stack = document.createElement('span');
      this.stack.className = 'animated-counter-stack';
      this.stack.setAttribute('aria-hidden', 'true');

      WHEEL.forEach((face) => {
        const item = document.createElement('span');
        item.className = 'animated-counter-face';
        item.textContent = String(face);
        this.stack.appendChild(item);
      });

      this.el.appendChild(this.stack);
      this.renderPos(initialDigit);
    }

    renderPos(p) {
      const offset = (-mod(p, 10) * 100) / WHEEL_LEN;
      this.stack.style.transform = `translate3d(0, ${offset}%, 0)`;
    }

    animateTo(targetDigit, heading, duration, reduced) {
      if (reduced) {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.currentPos = targetDigit;
        this.goal = targetDigit;
        this.renderPos(targetDigit);
        return;
      }

      if (mod(this.goal, 10) !== targetDigit) {
        const at = this.currentPos;
        this.goal =
          heading < 0
            ? at - mod(at - targetDigit, 10)
            : at + mod(targetDigit - at, 10);
      }

      const startPos = this.currentPos;
      const endPos = this.goal;
      const distance = endPos - startPos;

      if (Math.abs(distance) < 0.0001) {
        this.currentPos = endPos;
        this.renderPos(endPos);
        return;
      }

      if (this.animId) cancelAnimationFrame(this.animId);

      // Analytical damped harmonic oscillator matching Framer Motion's bounce = 0.18
      const zeta = 1 - BOUNCE; // 0.82
      const omega0 = 4.4 / Math.max(duration, 0.05);
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const startTime = performance.now();
      const totalDuration = duration * 1000 * 1.5;

      const step = (now) => {
        const elapsedSec = (now - startTime) / 1000;
        if (elapsedSec * 1000 >= totalDuration) {
          this.currentPos = endPos;
          this.renderPos(endPos);
          this.animId = null;
          return;
        }

        // Spring progress s(t) from 0 to 1 with overshoot
        const decay = Math.exp(-zeta * omega0 * elapsedSec);
        const progress =
          1 -
          decay *
            (Math.cos(omegaD * elapsedSec) +
              (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * elapsedSec));

        this.currentPos = startPos + distance * progress;
        this.renderPos(this.currentPos);
        this.animId = requestAnimationFrame(step);
      };

      this.animId = requestAnimationFrame(step);
    }

    destroy() {
      if (this.animId) cancelAnimationFrame(this.animId);
      this.el.remove();
    }
  }

  class AnimatedCounter {
    constructor(target, options = {}) {
      this.container =
        typeof target === 'string' ? document.querySelector(target) : target;
      if (!this.container) {
        throw new Error('AnimatedCounter: Target element not found');
      }

      this.decimals = options.decimals ?? 0;
      this.duration = options.duration ?? 0.6;
      this.padStart = options.padStart ?? 1;
      this.separator = options.separator ?? ',';
      this.decimalSeparator = options.decimalSeparator ?? '.';
      this.grouping = options.grouping ?? 'western';
      this.prefix = options.prefix ?? '';
      this.suffix = options.suffix ?? '';

      this.previousAmount = null;
      this.heading = 1;
      this.digitColumns = new Map(); // key -> DigitColumn

      this.setupDOM();
      this.setValue(options.value ?? 0, true);
    }

    setupDOM() {
      this.container.classList.add('animated-counter');
      this.container.setAttribute('data-slot', 'animated-counter');
      this.container.innerHTML = '';

      // Fixed Prefix
      this.prefixEl = document.createElement('span');
      this.prefixEl.className = 'animated-counter-fixed';
      if (this.prefix) this.prefixEl.textContent = this.prefix;
      this.container.appendChild(this.prefixEl);

      // Screen Reader Text
      this.srEl = document.createElement('span');
      this.srEl.className = 'animated-counter-sr';
      this.container.appendChild(this.srEl);

      // Visual container
      this.visualEl = document.createElement('span');
      this.visualEl.className = 'animated-counter-visual';
      this.visualEl.setAttribute('aria-hidden', 'true');
      this.container.appendChild(this.visualEl);

      // Negative Sign Element
      this.negativeEl = document.createElement('span');
      this.negativeEl.className = 'animated-counter-fixed';
      this.negativeEl.textContent = '-';
      this.negativeEl.style.display = 'none';
      this.visualEl.appendChild(this.negativeEl);

      // Cells Wrapper
      this.cellsWrapper = document.createElement('span');
      this.cellsWrapper.className = 'animated-counter-cells';
      this.cellsWrapper.style.display = 'inline-flex';
      this.cellsWrapper.style.alignItems = 'center';
      this.visualEl.appendChild(this.cellsWrapper);

      // Fixed Suffix
      this.suffixEl = document.createElement('span');
      this.suffixEl.className = 'animated-counter-fixed';
      if (this.suffix) this.suffixEl.textContent = this.suffix;
      this.container.appendChild(this.suffixEl);
    }

    setValue(newValue, isInitial = false) {
      const reduced = prefersReducedMotion();
      const numValue = Number(newValue) || 0;

      if (this.previousAmount !== null && this.previousAmount !== numValue) {
        this.heading = numValue >= this.previousAmount ? 1 : -1;
      }
      this.previousAmount = numValue;

      const shape = measure(numValue, this.decimals, this.padStart, this.duration);
      const chars = format(shape, this.separator, this.decimalSeparator, this.grouping);
      const cells = toCells(chars, shape.width);
      const isNegative = shape.amount < 0 && shape.scaled > 0;

      // Update screen reader text
      this.srEl.textContent = `${isNegative ? '-' : ''}${chars}`;

      // Update negative sign
      this.negativeEl.style.display = isNegative ? 'inline-block' : 'none';

      // Update prefix/suffix if changed
      if (this.prefix) {
        this.prefixEl.textContent = this.prefix;
        this.prefixEl.style.display = 'inline-block';
      } else {
        this.prefixEl.style.display = 'none';
      }

      if (this.suffix) {
        this.suffixEl.textContent = this.suffix;
        this.suffixEl.style.display = 'inline-block';
      } else {
        this.suffixEl.style.display = 'none';
      }

      // Reconcile cells
      const activeDigitKeys = new Set();
      this.cellsWrapper.innerHTML = '';

      cells.forEach((cell) => {
        if (cell.kind === 'digit') {
          activeDigitKeys.add(cell.key);
          let col = this.digitColumns.get(cell.key);
          if (!col) {
            col = new DigitColumn(cell.key, isInitial ? cell.digit : 0);
            this.digitColumns.set(cell.key, col);
          }
          this.cellsWrapper.appendChild(col.el);
          col.animateTo(cell.digit, this.heading, shape.pace, reduced || isInitial);
        } else {
          const mark = document.createElement('span');
          mark.className = 'animated-counter-mark';
          mark.setAttribute('data-slot', 'animated-counter-mark');
          mark.textContent = cell.char;
          this.cellsWrapper.appendChild(mark);
        }
      });

      // Cleanup unused columns
      for (const [key, col] of this.digitColumns.entries()) {
        if (!activeDigitKeys.has(key)) {
          col.destroy();
          this.digitColumns.delete(key);
        }
      }
    }

    updateOptions(newOptions = {}) {
      if (newOptions.decimals !== undefined) this.decimals = newOptions.decimals;
      if (newOptions.duration !== undefined) this.duration = newOptions.duration;
      if (newOptions.padStart !== undefined) this.padStart = newOptions.padStart;
      if (newOptions.separator !== undefined) this.separator = newOptions.separator;
      if (newOptions.decimalSeparator !== undefined) this.decimalSeparator = newOptions.decimalSeparator;
      if (newOptions.grouping !== undefined) this.grouping = newOptions.grouping;
      if (newOptions.prefix !== undefined) this.prefix = newOptions.prefix;
      if (newOptions.suffix !== undefined) this.suffix = newOptions.suffix;

      if (this.previousAmount !== null) {
        this.setValue(this.previousAmount);
      }
    }

    destroy() {
      for (const col of this.digitColumns.values()) {
        col.destroy();
      }
      this.digitColumns.clear();
      this.container.innerHTML = '';
      this.container.classList.remove('animated-counter');
    }
  }

  // Global helper to easily create or animate counters
  function animateCounter(el, value, options) {
    if (!el) return null;
    if (!el._animatedCounter) {
      el._animatedCounter = new AnimatedCounter(el, { ...options, value });
    } else {
      if (options) el._animatedCounter.updateOptions(options);
      el._animatedCounter.setValue(value);
    }
    return el._animatedCounter;
  }

  // Export to window
  global.AnimatedCounter = AnimatedCounter;
  global.animateCounter = animateCounter;
})(typeof window !== 'undefined' ? window : this);
