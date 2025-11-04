/**
 * Polyfill for Promise.withResolvers (available in Node.js 22+)
 * This is needed for pdfjs-dist compatibility with Node.js < 22
 */
export function ensurePromiseWithResolvers(): void {
  if (typeof (Promise as any).withResolvers !== 'function') {
    (Promise as any).withResolvers = function <T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: any) => void;
    } {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: any) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
}

/**
 * Ensure Path2D is available - @napi-rs/canvas provides it, but we need to check
 * This is required by pdfjs-dist for rendering PDF paths to canvas
 */
export async function ensurePath2D(): Promise<void> {
  // Check if Path2D already exists globally
  if (typeof (globalThis as any).Path2D !== 'undefined') {
    return; // Already exists, no need to polyfill
  }

  try {
    // Try to import Path2D from @napi-rs/canvas if available
    const canvasModule = await import('@napi-rs/canvas');
    if ((canvasModule as any).Path2D) {
      (globalThis as any).Path2D = (canvasModule as any).Path2D;
      return;
    }
  } catch (e) {
    // Canvas not imported yet or Path2D not available, continue with polyfill
  }

  // If Path2D still doesn't exist, create a basic polyfill
  // NOTE: This is a minimal polyfill - @napi-rs/canvas should provide the real implementation
  // This polyfill may not work perfectly with pdfjs-dist, so we should import canvas first
  if (typeof (globalThis as any).Path2D === 'undefined') {
    // Create a no-op Path2D that won't break pdfjs-dist
    // The real Path2D should come from @napi-rs/canvas
    (globalThis as any).Path2D = class Path2D {
      constructor(path?: any) {
        // Store constructor argument for compatibility
        if (path) {
          (this as any)._path = path;
        }
      }
      
      // Minimal implementation - these methods are called but the canvas handles rendering
      addPath() {}
      arc() {}
      arcTo() {}
      bezierCurveTo() {}
      closePath() {}
      ellipse() {}
      lineTo() {}
      moveTo() {}
      quadraticCurveTo() {}
      rect() {}
    };
  }
}

/**
 * Ensure all required polyfills for pdfjs-dist are available
 * Call this before importing pdfjs-dist
 */
export async function ensurePDFJSPolyfills(): Promise<void> {
  ensurePromiseWithResolvers();
  await ensurePath2D();
}

