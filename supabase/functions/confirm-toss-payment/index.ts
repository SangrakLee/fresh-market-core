import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { paymentKey, orderId, amount } = await req.json() // 이번에 추가

    if (!paymentKey || !orderId || !amount) {
      return new Response(
        JSON.stringify({ message: 'paymentKey, orderId, amount가 필요합니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 이번에 추가: DB에서 주문 조회
    const { data: orderRow, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, order_status')
      .eq('order_code', orderId)
      .single()

    if (orderError || !orderRow) {
      return new Response(
        JSON.stringify({ message: '주문을 찾을 수 없습니다.' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // 이번에 추가: amount 변조 방지
    if (Number(orderRow.total_amount) !== Number(amount)) {
      return new Response(
        JSON.stringify({ message: '결제 금액이 주문 금액과 다릅니다.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // 이번에 추가: 이미 paid면 중복 승인 방지
    if (orderRow.order_status === 'paid') {
      return new Response(
        JSON.stringify({ message: '이미 승인된 주문입니다.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const tossSecretKey = Deno.env.get('TOSS_SECRET_KEY')!
    const encodedKey = btoa(`${tossSecretKey}:`) // 이번에 추가: Basic 인증

    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encodedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    })

    const tossResult = await tossResponse.json()

    if (!tossResponse.ok) {
      await supabaseAdmin
        .from('orders')
        .update({
          order_status: 'failed',
          failed_reason: tossResult?.message || '승인 실패',
        })
        .eq('order_code', orderId)

      return new Response(JSON.stringify(tossResult), {
        status: tossResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin
      .from('orders')
      .update({
        order_status: 'paid',
        payment_key: tossResult.paymentKey || paymentKey,
        payment_method: tossResult.method || null,
        paid_at: new Date().toISOString(),
        failed_reason: null,
      })
      .eq('order_code', orderId)

    return new Response(JSON.stringify(tossResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: '승인 처리 중 예외가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})