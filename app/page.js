import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>DuoCast</h1>
      <Link href="/room/test123">
        <button style={{ padding: "10px 20px", fontSize: "16px" }}>
          Join Room: test123
        </button>
      </Link>
    </div>
  );
}
