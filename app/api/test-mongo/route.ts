import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'

export async function GET() {
  try {
    const client = await connectToMongoDB()
    const db = client.db(process.env.MONGODB_DB)
    
    // Test ping
    await db.admin().ping()
    
    return NextResponse.json({ message: 'MongoDB connected!' })
  } catch {
    // Remove unused 'error' parameter
    return NextResponse.json({ error: 'Connection failed' }, { status: 500 })
  }
}
