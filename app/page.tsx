import GameClient from "@/components/GameClient";

export default function Home() {
  return (
    <>
      <h1 className="sr-only">Smoothie Cat Café</h1>
      <GameClient />
      <noscript>
        <p style={{ padding: 24 }}>Smoothie Cat Café needs JavaScript to run.</p>
      </noscript>
    </>
  );
}
