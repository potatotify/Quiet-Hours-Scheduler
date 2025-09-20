import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('Testing email functionality...')
    
    // Test with your actual email
    const testEmail = process.env.EMAIL_USER // This will send to yourself
    
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail: testEmail,
        subject: 'Test Mathematics Study Session',
        startTime: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
      })
    })

    const data = await response.json()

    if (response.ok) {
      return NextResponse.json({ 
        message: 'Test email sent successfully!',
        details: data
      })
    } else {
      return NextResponse.json({ 
        error: 'Failed to send test email',
        details: data
      }, { status: 500 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: `Test failed: ${errorMessage}` 
    }, { status: 500 })
  }
}
