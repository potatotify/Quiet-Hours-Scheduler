import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'

const MONGODB_DB = process.env.MONGODB_DB!

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 CRON job started at:', new Date().toISOString())
    
    // Security check
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && 
        !request.url.includes('localhost')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await connectToMongoDB()
    const db = client.db(MONGODB_DB)

    const now = new Date()
    console.log(`⏰ Current time: ${now.toLocaleString()}`)

    // Find ALL study blocks first to debug
    const allBlocks = await db.collection('study_blocks').find({}).toArray()
    console.log(`📊 Total blocks in database: ${allBlocks.length}`)
    
    allBlocks.forEach(block => {
      console.log(`📝 Block: ${block.subject}`)
      console.log(`   Start: ${new Date(block.start_time).toLocaleString()}`)
      console.log(`   Notification: ${new Date(block.notification_time).toLocaleString()}`)
      console.log(`   Sent: ${block.notification_sent}`)
      console.log(`   Should notify: ${new Date(block.notification_time) <= now && new Date(block.start_time) > now && !block.notification_sent}`)
    })

    // Find study blocks that need notifications
    const blocksToNotify = await db.collection('study_blocks').find({
      notification_sent: false,
      notification_time: { $lte: now },
      start_time: { $gt: now }
    }).toArray()

    console.log(`📧 Found ${blocksToNotify.length} blocks needing notifications`)

    const results = []

    for (const block of blocksToNotify) {
      try {
        console.log(`📤 Sending notification for: ${block.subject} to ${block.user_email}`)
        
        // Send email
        const emailResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userEmail: block.user_email,
            subject: block.subject,
            startTime: block.start_time
          })
        })

        const emailData = await emailResponse.json()

        if (emailResponse.ok) {
          // Mark as sent in database
          await db.collection('study_blocks').updateOne(
            { _id: block._id },
            { 
              $set: { 
                notification_sent: true,
                notification_sent_at: new Date()
              } 
            }
          )

          results.push({ 
            id: block._id.toString(), 
            email: block.user_email, 
            subject: block.subject,
            status: 'sent',
            messageId: emailData.messageId
          })

          console.log(`✅ Notification sent successfully for ${block.subject}`)
        } else {
          results.push({ 
            id: block._id.toString(), 
            email: block.user_email, 
            subject: block.subject,
            status: 'failed',
            error: emailData.error
          })
          console.log(`❌ Failed to send notification: ${emailData.error}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`💥 Error processing block ${block._id}:`, error)
        results.push({ 
          id: block._id.toString(), 
          status: 'error',
          error: errorMessage 
        })
      }
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      currentTime: now.toLocaleString(),
      totalBlocks: allBlocks.length,
      processed: blocksToNotify.length,
      results: results,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      errors: results.filter(r => r.status === 'error').length
    }

    console.log('📊 CRON job completed:', summary)
    return NextResponse.json(summary)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('💥 CRON job failed:', error)
    return NextResponse.json({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
