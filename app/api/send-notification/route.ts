import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting email send process...')
    
    const { userEmail, subject, startTime } = await request.json()

    if (!userEmail || !subject || !startTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create Gmail transporter - FIXED: createTransport (not createTransporter)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    // Test connection
    await transporter.verify()
    console.log('Email connection verified')

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
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">⏰ Study Time Alert</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Your focus session is about to begin!</p>
            </div>
            
            <!-- Main Content -->
            <div style="padding: 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">📚 ${subject}</h2>
              
              <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; border-left: 4px solid #3B82F6; margin: 20px 0;">
                <p style="color: #1e40af; margin: 0; font-size: 18px; font-weight: bold;">⏰ Starts in 10 minutes</p>
                <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px;">
                  <strong>Time:</strong> ${formattedTime}
                </p>
              </div>
              
              <!-- Tips Section -->
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
            
            <!-- Footer -->
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

    console.log(`✅ Email sent successfully to ${userEmail}`, result.messageId)
    return NextResponse.json({ 
      success: true, 
      messageId: result.messageId,
      message: 'Email sent successfully' 
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Email sending failed:', error)
    return NextResponse.json({ 
      error: `Failed to send email: ${errorMessage}` 
    }, { status: 500 })
  }
}
