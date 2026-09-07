import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type ReactNode
} from 'react';
const DialogContext = createContext<(open: boolean) => void>(() => {});
export function Dialog({
  open,
  onOpenChange,
  children
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return open ? (
    <DialogContext.Provider value={onOpenChange}>
      {children}
    </DialogContext.Provider>
  ) : null;
}
export function DialogContent({
  children,
  className
}: HTMLAttributes<HTMLDialogElement>) {
  const ref = useRef<HTMLDialogElement>(null),
    close = useContext(DialogContext);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-label="Game options"
      onCancel={(e) => {
        e.preventDefault();
        close(false);
      }}
    >
      <button
        className="bw-dialog-close"
        aria-label="Close dialog"
        onClick={() => close(false)}
      >
        ×
      </button>
      {children}
    </dialog>
  );
}
export const DialogTitle = ({
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>;
export const DialogDescription = ({
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>;
export function Slider({
  value,
  onValueChange,
  min,
  max,
  step,
  ...props
}: {
  value: number[];
  onValueChange: (v: number[]) => void;
  min: number;
  max: number;
  step: number;
  'aria-label'?: string;
}) {
  return (
    <input
      {...props}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(e) => onValueChange([Number(e.target.value)])}
    />
  );
}
export function Switch({
  checked,
  onCheckedChange,
  ...props
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  'aria-label'?: string;
}) {
  return (
    <input
      {...props}
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  );
}
const RadioContext = createContext({
  value: '',
  name: '',
  change: (_v: string) => {}
});
export function RadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  value: string;
  onValueChange: (v: string) => void;
}) {
  const name = useId();
  return (
    <RadioContext.Provider value={{ value, name, change: onValueChange }}>
      <div {...props} role="radiogroup">
        {children}
      </div>
    </RadioContext.Provider>
  );
}
export function RadioGroupItem({
  value,
  ...props
}: {
  value: string;
  'aria-label'?: string;
}) {
  const group = useContext(RadioContext);
  return (
    <input
      {...props}
      data-slot="radio-group-item"
      type="radio"
      name={group.name}
      value={value}
      checked={group.value === value}
      onChange={() => group.change(value)}
    />
  );
}
