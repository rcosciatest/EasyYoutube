/**
 * Canvas roundRect polyfill for browsers that don't support it natively
 * This fixes TypeScript compatibility issues while maintaining functionality
 */
export const applyCanvasPolyfills = () => {
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(
      x: number, 
      y: number, 
      width: number, 
      height: number, 
      radius: number | number[] | DOMPointInit | (number | DOMPointInit)[] | undefined
    ) {
      // Normalize radius to a single number for simplicity
      let r = 0;
      if (typeof radius === 'number') {
        r = radius;
      } else if (Array.isArray(radius) && radius.length > 0) {
        r = typeof radius[0] === 'number' ? radius[0] as number : 0;
      }
      
      // Ensure radius doesn't exceed dimensions
      r = Math.min(r, Math.min(width, height) / 2);
      
      // Draw rounded rectangle
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + width, y, x + width, y + height, r);
      this.arcTo(x + width, y + height, x, y + height, r);
      this.arcTo(x, y + height, x, y, r);
      this.arcTo(x, y, x + width, y, r);
      this.closePath();
      
      // For backwards compatibility, we want to match both signatures
      return this;
    };
  }
}; 