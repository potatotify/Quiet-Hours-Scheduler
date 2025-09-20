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

    // CREATE PROPER IST DATETIME
    // Parse the date and time components
    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes] = startTime.split(':').map(Number)
    
    // Create date in IST (UTC+5:30) by manually offsetting
    const istOffset = 5.5 * 60 * 60 * 1000 // IST is UTC+5:30 in milliseconds
    
    // Create UTC datetime first
    const utcDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0))
    
    // Subtract IST offset to get the correct local time
    const startDateTime = new Date(utcDateTime.getTime() - istOffset)
    
    // Calculate end and notification times
    const endDateTime = new Date(startDateTime.getTime() + finalDuration * 60 * 1000)
    const notificationTime = new Date(startDateTime.getTime() - 10 * 60 * 1000)

    // Check if it's at least 10 minutes in future
    const now = new Date()
    if (notificationTime <= now) {
      return NextResponse.json({ 
        error: 'Study block must be scheduled at least 10 minutes in advance' 
      }, { status: 400 })
    }

    console.log('📅 IST Timezone Handling:')
    console.log('   Input Date:', date)
    console.log('   Input Time:', startTime)
    console.log('   Parsed Components:', { year, month: month-1, day, hours, minutes })
    console.log('   UTC DateTime:', utcDateTime.toISOString())
    console.log('   IST Offset (ms):', istOffset)
    console.log('   Final Start Time (UTC):', startDateTime.toISOString())
    console.log('   Final Start Time (IST):', startDateTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
    console.log('   Notification Time:', notificationTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))

    // Connect to MongoDB
    const client = await connectToMongoDB()
    const db = client.db(MONGODB_DB)
    
    // Check for time collision with existing blocks
    const conflictingBlock = await db.collection('study_blocks').findOne({
      user_id: user.id,
      $or: [
        {
          start_time: { $lte: startDateTime },
          end_time: { $gt: startDateTime }
        },
        {
          start_time: { $lt: endDateTime },
          end_time: { $gte: endDateTime }
        },
        {
          start_time: { $gte: startDateTime },
          end_time: { $lte: endDateTime }
        }
      ]
    })

    if (conflictingBlock) {
      const conflictTime = new Date(conflictingBlock.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
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
    return NextResponse.json({ 
      success: true, 
      id: result.insertedId,
      message: 'Study block created successfully!',
      debug: {
        inputDate: date,
        inputTime: startTime,
        startTimeUTC: startDateTime.toISOString(),
        startTimeIST: startDateTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notificationTimeIST: notificationTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      }
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
