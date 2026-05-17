import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, vacancyData } = await req.json()

    const token = Deno.env.get('WHATSAPP_API_TOKEN')
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const recipient = Deno.env.get('WHATSAPP_RECIPIENT_NUMBER')

    if (!token || !phoneId || !recipient) {
      throw new Error('Missing WhatsApp environment variables in Edge Function secrets. Required: WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_RECIPIENT_NUMBER')
    }

    // TEST ACTION
    if (action === 'test') {
      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: 'Test message from New Vacancy Edge Function!' }
        })
      })
      
      const result = await response.json()
      if (!response.ok) {
        throw new Error(`WhatsApp API Error: ${result.error?.message || JSON.stringify(result)}`)
      }

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // SEND VACANCY NOTIFICATION
    if (!vacancyData) {
      throw new Error('Missing vacancyData payload')
    }

    console.log('WhatsApp send triggered', vacancyData)

    // The user wants to use a template. Fallback to basic text if template is strict, 
    // but the instruction says to use template with variables.
    const body = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: 'new_vacancy_alert', // You must create this template in Meta Business Manager
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: vacancyData.title || 'N/A' },
              { type: 'text', text: vacancyData.organization || 'N/A' },
              { type: 'text', text: vacancyData.location || 'N/A' },
              { type: 'text', text: vacancyData.last_date || 'N/A' },
              { type: 'text', text: vacancyData.apply_url || 'N/A' }
            ]
          }
        ]
      }
    }

    const waResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const waResult = await waResponse.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (!waResponse.ok) {
      const errMsg = waResult.error?.message || JSON.stringify(waResult)
      console.error('WhatsApp send failed:', errMsg)
      
      // Log failure
      await supabase.from('whatsapp_logs').insert({
        vacancy_id: vacancyData.id,
        status: 'failed',
        error_message: errMsg
      })

      throw new Error(errMsg)
    }

    // Log success
    await supabase.from('whatsapp_logs').insert({
      vacancy_id: vacancyData.id,
      status: 'success'
    })

    return new Response(JSON.stringify({ success: true, waResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in whatsapp-notify function:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
