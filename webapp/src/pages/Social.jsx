import Messages from './Messages.jsx';

/**
 * The Social navigation destination is the TonPlaygram social hub itself.
 * Keep /messages available as a direct link while presenting the same focused,
 * portrait-friendly experience from the primary Social tab.
 */
export default function Social() {
  return <Messages />;
}
