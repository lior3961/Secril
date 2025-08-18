export default function Button({ as = 'button', className = '', ...props }) {
  const Comp = as;
  const base = 'btn';
  return <Comp className={`${base} ${className}`} {...props} />;
}
