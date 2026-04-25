const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const toMemberType = (relations: string[]) => {
  if (relations.includes('ADDED')) return '고정고객'
  if (relations.includes('BLOCKED') || relations.includes('NONE')) return '회원'
  return '회원'
}

const parseChannelIds = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const normalized = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',')

  return normalized || undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'POST 요청만 허용됩니다.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { targetId, channelIds } = await req.json()

    if (!targetId) {
      return new Response(JSON.stringify({ message: 'targetId는 필수입니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminKey = Deno.env.get('KAKAO_ADMIN_KEY')
    if (!adminKey) {
      return new Response(
        JSON.stringify({ message: '환경변수 KAKAO_ADMIN_KEY가 설정되지 않았습니다.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const query = new URLSearchParams({
      target_id: String(targetId),
      target_id_type: 'user_id',
    })

    const fromBody = parseChannelIds(channelIds)
    const fromEnv = parseChannelIds(Deno.env.get('KAKAO_CHANNEL_PUBLIC_IDS'))
    const mergedChannelIds = fromBody || fromEnv
    if (mergedChannelIds) {
      query.set('channel_ids', mergedChannelIds)
      query.set('channel_id_type', 'channel_public_id')
    }

    const kakaoResponse = await fetch(`https://kapi.kakao.com/v2/api/talk/channels?${query}`, {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${adminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    })

    const kakaoResult = await kakaoResponse.json()
    if (!kakaoResponse.ok) {
      return new Response(
        JSON.stringify({
          message: '카카오 채널 관계 조회에 실패했습니다.',
          kakao: kakaoResult,
        }),
        {
          status: kakaoResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const channels = Array.isArray(kakaoResult?.channels) ? kakaoResult.channels : []
    const relations = channels.map((channel: { relation?: string }) => channel.relation).filter(Boolean)

    return new Response(
      JSON.stringify({
        userId: kakaoResult?.user_id ?? Number(targetId),
        memberType: toMemberType(relations),
        relations,
        channels,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: '요청 처리 중 예외가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})