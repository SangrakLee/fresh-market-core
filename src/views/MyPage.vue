<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()

const session = ref(null)
const authUserLabel = ref('')

const signInWithKakao = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
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
  router.push('/')
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  session.value = data.session || null

  if (session.value?.user) {
    authUserLabel.value =
      session.value.user.email || session.value.user.user_metadata?.name || '카카오 사용자'
  }
})
</script>

<template>
  <div class="min-h-screen bg-white px-6 pt-8 pb-24">
    <div class="mx-auto max-w-[430px]">
      <div class="mb-6">
        <p class="mb-1 text-xs text-black/40">고마마정품</p>
        <h1 class="text-2xl font-bold text-black">마이고정</h1>
      </div>

      <template v-if="session">
        <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="text-sm font-bold text-gray-900">로그인됨</div>
          <div class="mt-1 text-sm text-gray-500">{{ authUserLabel }}</div>

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
