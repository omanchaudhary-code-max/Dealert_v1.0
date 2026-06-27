import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getMongoDb();

    const result = await db.collection("price_history").aggregate([
      {
        $group: {
          _id: {
            month: { $month: "$scraped_at" },
            year:  { $year: "$scraped_at" },
          },
          avgPrice: { $avg: "$current_price" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]).toArray();

    if (!result.length) {
      return NextResponse.json(getMockData());
    }

    const basePrice = result[0].avgPrice;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const indexData = result.map((r) => ({
      month: months[r._id.month - 1],
      index: Number(((r.avgPrice / basePrice) * 100).toFixed(1)),
    }));

    return NextResponse.json(indexData);

  } catch {
    return NextResponse.json(getMockData());
  }
}

function getMockData() {
  return [
    { month: "Jan", index: 100 },
    { month: "Feb", index: 101.4 },
    { month: "Mar", index: 102.8 },
    { month: "Apr", index: 101.9 },
    { month: "May", index: 102.5 },
    { month: "Jun", index: 101.8 },
  ];
}