import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Call the local Python FastAPI Engine
        const res = await fetch('http://localhost:8000/api/reformer/equilibrium', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            return NextResponse.json({ error: "Python chemistry engine error" }, { status: 500 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Chemistry engine connection failed:", error);
        return NextResponse.json({ error: "Failed to connect to Python Chemistry Engine" }, { status: 503 });
    }
}
