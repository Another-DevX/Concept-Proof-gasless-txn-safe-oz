import { NextRequest, NextResponse } from 'next/server'

async function sendMetaTx (request: any[]) {
  const url = process.env.WEBHOOK_URL
  if (!url) {
    console.error('Relayer URL is missing')
    throw new Error('Missing relayer URL')
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json' }
    })

    // Considerar agregar manejo para respuestas no exitosas del servidor
    if (!response.ok) {
      throw new Error(`Relayer responded with status ${response.status}`)
    }

    return response.json() // Asumiendo que el relayer devuelve una respuesta en JSON
  } catch (error) {
    console.error('Failed to send meta transaction:', error)
    throw new Error('Failed to send meta transaction')
  }
}

export async function POST (req: NextRequest) {
  try {
    const data = await req.json()
    console.log('Received body:', data)

    // Validación de los datos recibidos
    if (!data.request || !data.signature) {
      throw new Error('Invalid request data')
    }

    await sendMetaTx(data)

    return NextResponse.json({ message: 'Meta transaction sent successfully' })
  } catch (error) {
    console.error('Error handling POST request:', error)
    // Considerar enviar una respuesta de error adecuada al cliente
    return NextResponse.json({ error }, { status: 500 })
  }
}
