import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Get user token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    // Check user with Supabase
    const { data: { user } } = await supabase.auth.getUser(token)
    
    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    // Get form data
    const { subject, duration, date, startTime, customDuration, useCustomTime } = await request.json()

    // Check required fields
    if (!subject || !date || !startTime) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Calculate duration
    const finalDuration = useCustomTime ? parseInt(customDuration) : parseInt(duration)
    
    // Create start and end times
    const startDateTime = new Date(`${date}T${startTime}:00`)
    const endDateTime = new Date(startDateTime.getTime() + finalDuration * 60 * 1000)
    
    // Create notification time (10 minutes before)
    const notificationTime = new Date(startDateTime.getTime() - 10 * 60 * 1000)

    // Check if it's at least 10 minutes in future
    if (notificationTime <= new Date()) {
      return NextResponse.json({ error: 'Must be 10+ minutes in advance' }, { status: 400 })
    }

    // Connect to MongoDB
    const client = await connectToMongoDB()
    const db = client.db(process.env.MONGODB_DB)
    
    // Create study block object
    const studyBlock = {
      user_id: user.id,
      user_email: user.email,
      subject: subject,
      duration: finalDuration,
      start_time: startDateTime,
      end_time: endDateTime,
      notification_time: notificationTime,
      notification_sent: false,
      status: 'upcoming',
      created_at: new Date()
    }

    // Save to database
    const result = await db.collection('study_blocks').insertOne(studyBlock)

    return NextResponse.json({ success: true, id: result.insertedId })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    // Check user
    const { data: { user } } = await supabase.auth.getUser(token)
    
    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    // Connect to MongoDB
    const client = await connectToMongoDB()
    const db = client.db(process.env.MONGODB_DB)
    
    // Get user's study blocks
    const studyBlocks = await db.collection('study_blocks')
      .find({ user_id: user.id })
      .sort({ start_time: 1 })
      .toArray()

    return NextResponse.json({ studyBlocks })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
