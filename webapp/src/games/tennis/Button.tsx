import React from 'react';
// Game-specific touch controls use the host app's native React button contract.
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }
>(function Button({ variant: _variant, ...props }, ref) {
  return <button type="button" ref={ref} {...props} />;
});
