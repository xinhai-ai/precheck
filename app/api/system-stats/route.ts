import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const revalidate = 300

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({
        users_count: 0,
        applications_count: 0,
        approved_count: 0,
      })
    }

    const [usersCount, applicationsCount, approvedCount] = await Promise.all([
      db.user.count(),
      db.preApplication.count(),
      db.preApplication.count({ where: { status: "APPROVED" } }),
    ])

    return NextResponse.json({
      users_count: usersCount,
      applications_count: applicationsCount,
      approved_count: approvedCount,
    })
  } catch {
    return NextResponse.json({
      users_count: 0,
      applications_count: 0,
      approved_count: 0,
    })
  }
}
