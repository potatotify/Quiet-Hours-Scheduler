import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'
import { supabase } from '@/lib/supabase'
import { ObjectId } from 'mongodb'

const MONGODB_DB = process.env.MONGODB_DB!

export async function POST(request: NextRequest) {
  try {
    // Get user from Supabase auth
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 })
    }

    const { data: { user } } = await supabase.auth.getUser(token)
    
    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const { subject, duration, date, startTime, customDuration, useCustomTime } = await request.json()

    // Check required fields
    if (!subject || !date || !startTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate duration
    const finalDuration = useCustomTime ? parseInt(customDuration) : parseInt(duration)
    
    if (!finalDuration || finalDuration < 1 || finalDuration > 480) {
      return NextResponse.json({ error: 'Invalid duration (1-480 minutes)' }, { status: 400 })
    }

    // Create start and end times
    const startDateTime = new Date(`${date}T${startTime}:00`)
    const endDateTime = new Date(startDateTime.getTime() + finalDuration * 60 * 1000)
    
    // Create notification time (10 minutes before)
    const notificationTime = new Date(startDateTime.getTime() - 10 * 60 * 1000)

    // Check if it's at least 10 minutes in future
    if (notificationTime <= new Date()) {
      return NextResponse.json({ 
        error: 'Study block must be scheduled at least 10 minutes in advance' 
      }, { status: 400 })
    }

    // Connect to MongoDB
    const client = await connectToMongoDB()
    const db = client.db(MONGODB_DB)
    
    // Check for time collision with existing blocks
    const conflictingBlock = await db.collection('study_blocks').findOne({
      user_id: user.id,
      $or: [
        // New block starts during existing block
        {
          start_time: { $lte: startDateTime },
          end_time: { $gt: startDateTime }
        },
        // New block ends during existing block
        {
          start_time: { $lt: endDateTime },
          end_time: { $gte: endDateTime }
        },
        // New block completely contains existing block
        {
          start_time: { $gte: startDateTime },
          end_time: { $lte: endDateTime }
        }
      ]
    })

    if (conflictingBlock) {
      const conflictTime = new Date(conflictingBlock.start_time).toLocaleString()
      return NextResponse.json({ 
        error: `Time conflict! You have "${conflictingBlock.subject}" scheduled at ${conflictTime}` 
      }, { status: 409 })
    }

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

    console.log(`✅ Study block created: ${subject} for ${user.email}`)
    console.log(`📅 Scheduled: ${startDateTime.toLocaleString()}`)
    console.log(`⏰ Notification: ${notificationTime.toLocaleString()}`)

    return NextResponse.json({ 
      success: true, 
      id: result.insertedId,
      message: 'Study block created successfully!' 
    })

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
    const db = client.db(MONGODB_DB)
    
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

export async function DELETE(request: NextRequest) {
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

    const { blockId } = await request.json()
    
    if (!blockId) {
      return NextResponse.json({ error: 'Block ID required' }, { status: 400 })
    }

    // Connect to MongoDB
    const client = await connectToMongoDB()
    const db = client.db(MONGODB_DB)
    
    // Delete the study block (only if it belongs to the user)
    const result = await db.collection('study_blocks').deleteOne({
      _id: new ObjectId(blockId),
      user_id: user.id // Security: only delete user's own blocks
    })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Study block not found' }, { status: 404 })
    }

    console.log(`🗑️ Study block deleted: ${blockId} by ${user.email}`)
    return NextResponse.json({ success: true, message: 'Study block deleted' })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
