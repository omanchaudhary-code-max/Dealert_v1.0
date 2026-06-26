import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";

export function withAuth(handler: Function) {
  return async (request: Request, ...args: any[]) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Access token missing" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    try {
      const payload = await verifyAccessToken(token);
      return handler(request, payload, ...args);
    } catch {
      return NextResponse.json({ error: "Unauthorized: Access token expired" }, { status: 401 });
    }
  };
}

export default withAuth;