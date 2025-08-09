import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function FallingBall() {
  useTelegramBackButton();
  return (
    <iframe
      src="/falling-ball.html"
      title="Falling Ball"
      className="w-full h-screen border-0"
    />
  );
}
