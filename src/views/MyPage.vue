<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()

const session = ref(null)
const authUserLabel = ref('')
const memberType = ref('비회원')
const relationStatus = ref('')

const resolveMemberType = (hasSession) => {
  if (!hasSession) return '비회원'

  // 카카오 채널 관계 조회 전 기본값
  return '회원'
}

const getKakaoTargetId = async (providerToken) => {
  if (!providerToken) return null

  const meResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${providerToken}`,
    },
  })

  if (!meResponse.ok) {
    const errorBody = await meResponse.text()
    throw new Error(`카카오 사용자 조회 실패: ${meResponse.status} ${errorBody}`)
  }

  const me = await meResponse.json()
  return me?.id ? String(me.id) : null
}

const fetchMemberTypeFromKakaoRelation = async (currentSession) => {
  const providerToken = currentSession?.provider_token
  const targetId = await getKakaoTargetId(providerToken)
  if (!targetId) return

  const { data, error } = await supabase.functions.invoke('check-kakao-channel-relation', {
    body: { targetId },
  })

  if (error) {
    throw new Error(error.message || '카카오 채널 관계 조회 함수 호출 실패')
  }

  if (data?.memberType) {
    memberType.value = data.memberType
    relationStatus.value = Array.isArray(data.relations) ? data.relations.join(', ') : ''
  }
}

const signInWithKakao = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'profile_nickname profile_image account_email plusfriends',
      queryParams: {
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error('카카오 로그인 에러:', error.message)
  }
}

const signOut = async () => {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('로그아웃 에러:', error.message)
    return
  }

  session.value = null
  authUserLabel.value = ''
  memberType.value = resolveMemberType(false)
  relationStatus.value = ''
  router.push('/')
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  const currentSession = data.session || null
  session.value = currentSession
  memberType.value = resolveMemberType(!!session.value)

  if (session.value?.user) {
    authUserLabel.value =
      session.value.user.email || session.value.user.user_metadata?.name || '카카오 사용자'

    try {
      await fetchMemberTypeFromKakaoRelation(currentSession)
    } catch (error) {
      console.error('카카오 채널 관계 연동 에러:', error)
    }
  }
})
</script>

<template>
  <div class="min-h-screen bg-white px-6 pt-8 pb-24">
    <div class="mx-auto max-w-[430px]">
      <template v-if="session">
        <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="text-sm font-bold text-gray-900">로그인됨</div>
          <div class="mt-1 text-sm text-gray-500">{{ authUserLabel }}</div>
          <div class="mt-2 text-sm text-gray-700">
            회원 구분:
            <span class="font-semibold text-gray-900">{{ memberType }}</span>
          </div>
          <div v-if="relationStatus" class="mt-1 text-xs text-gray-500">
            카카오 채널 관계: {{ relationStatus }}
          </div>

          <div class="mt-4 space-y-3">
            <button
              class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              @click="router.push('/orders')"
            >
              주문내역 보기
            </button>

            <button
              class="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
              @click="signOut"
            >
              로그아웃
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="text-sm font-bold text-gray-900">비회원 상태</div>
          <div class="mt-1 text-sm text-gray-500">카카오 로그인 후 이용할 수 있어요</div>
          <div class="mt-2 text-sm text-gray-700">
            회원 구분:
            <span class="font-semibold text-gray-900">{{ memberType }}</span>
          </div>

          <button
            class="mt-4 w-full rounded-xl bg-yellow-400 px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-yellow-300"
            @click="signInWithKakao"
          >
            카카오 로그인
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
