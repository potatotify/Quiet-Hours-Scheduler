import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'

const MONGODB_DB = process.env.MONGODB_DB!

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 CRON job started at:', new Date().toISOString())
    
    // Security check - allow deployment without auth header
    const authHeader = request.headers.get('authorization')
    const isLocalhost = request.url.includes('localhost')
    const isVercelDeployment = request.headers.get('host')?.includes('vercel.app')
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !isLocalhost && !isVercelDeployment) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await connectToMongoDB()
    const db = client.db(MONGODB_DB)

    const now = new Date()
    console.log(`⏰ Current time: ${now.toLocaleString()}`)

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
        
        // FIXED: Call email API directly instead of fetch
        const emailResult = await sendEmailNotification(
          block.user_email,
          block.subject,
          block.start_time
        )

        if (emailResult.success) {
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
            messageId: emailResult.messageId
          })

          console.log(`✅ Notification sent successfully for ${block.subject}`)
        } else {
          results.push({ 
            id: block._id.toString(), 
            email: block.user_email, 
            subject: block.subject,
            status: 'failed',
            error: emailResult.error
          })
          console.log(`❌ Failed to send notification: ${emailResult.error}`)
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
      totalBlocks: await db.collection('study_blocks').countDocuments(),
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

// DIRECT EMAIL FUNCTION (no fetch required)
async function sendEmailNotification(userEmail: string, subject: string, startTime: Date) {
  try {
    const nodemailer = require('nodemailer')
    
    // Create Gmail transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    // Test connection
    await transporter.verify()

    const formattedTime = new Date(startTime).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Study Time Reminder</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            
            <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">⏰ Study Time Alert</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Your focus session is about to begin!</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">📚 ${subject}</h2>
              
              <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; border-left: 4px solid #3B82F6; margin: 20px 0;">
                <p style="color: #1e40af; margin: 0; font-size: 18px; font-weight: bold;">⏰ Starts in 10 minutes</p>
                <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">
                  <strong>Time:</strong> ${formattedTime}
                </p>
              </div>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; border: 1px solid #bbf7d0; margin: 20px 0;">
                <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 16px;">💡 Quick prep checklist:</h3>
                <ul style="color: #166534; margin: 0; padding-left: 20px; line-height: 1.6;">
                  <li>Find a quiet, comfortable space</li>
                  <li>Gather all your study materials</li>
                  <li>Keep water and snacks nearby</li>
                  <li>Turn off distracting notifications</li>
                  <li>Take a deep breath and get ready to focus!</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 16px; margin: 0;">You've got this! 🎯</p>
              </div>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; margin: 0; font-size: 14px;">
                You're receiving this because you scheduled a study block.<br>
                <strong>Study Blocks App</strong> - Helping you stay focused!
              </p>
            </div>
            
          </div>
        </body>
      </html>
    `

    // Send email
    const result = await transporter.sendMail({
      from: `"Study Blocks" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `📚 ${subject} - Study session starts in 10 minutes!`,
      html: emailHtml,
    })

    return { 
      success: true, 
      messageId: result.messageId 
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Email sending failed:', error)
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}
