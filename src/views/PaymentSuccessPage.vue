<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()

const paymentKey = computed(() => route.query.paymentKey || '')
const orderId = computed(() => route.query.orderId || '')
const amount = computed(() => route.query.amount || '')

const isApproving = ref(false)
const approveMessage = ref('')
const approveError = ref('')

const resolveInvokeErrorMessage = async (error) => {
  const baseMessage = error?.message || '승인 요청 실패'
  const context = error?.context
  if (!context) return baseMessage

  try {
    const payload = await context.json()
    if (payload?.message) return `${baseMessage} - ${payload.message}`
    if (payload?.error) return `${baseMessage} - ${payload.error}`
  } catch {
    // context body parse 실패 시 기본 메시지 사용
  }

  return baseMessage
}

const confirmPayment = async () => {
  isApproving.value = true
  approveMessage.value = ''
  approveError.value = ''

  const { data, error } = await supabase.functions.invoke('confirm-toss-payment', {
    body: {
      paymentKey: paymentKey.value,
      orderId: orderId.value,
      amount: Number(amount.value),
    },
  })

  if (error) {
    approveError.value = await resolveInvokeErrorMessage(error)
    isApproving.value = false
    return
  }

  console.log('승인 결과:', data)
  approveMessage.value = '결제 승인 완료'
  isApproving.value = false
}

onMounted(async () => {
  if (!paymentKey.value || !orderId.value || !amount.value) {
    approveError.value = '결제 성공 파라미터가 올바르지 않습니다.'
    return
  }

  await confirmPayment()
})
</script>

<template>
  <div class="min-h-screen bg-white px-6 py-10 text-black">
    <div class="mx-auto max-w-md">
      <p class="mb-2 text-xs tracking-[0.2em] text-black/40 uppercase">고마마정품</p>
      <h1 class="text-2xl font-bold">결제 성공</h1>

      <p v-if="isApproving" class="mt-4 text-sm text-black/60">결제 승인 처리 중입니다...</p>

      <p v-if="approveMessage" class="mt-4 text-sm font-medium text-emerald-600">
        {{ approveMessage }}
      </p>

      <p v-if="approveError" class="mt-4 text-sm font-medium text-red-500">
        {{ approveError }}
      </p>

      <div class="mt-6 space-y-3 rounded-2xl border border-black/10 bg-black/[0.03] p-4">
        <div>
          <p class="text-xs text-black/40">paymentKey</p>
          <p class="break-all text-sm font-medium">{{ paymentKey }}</p>
        </div>

        <div>
          <p class="text-xs text-black/40">orderId</p>
          <p class="break-all text-sm font-medium">{{ orderId }}</p>
        </div>

        <div>
          <p class="text-xs text-black/40">amount</p>
          <p class="text-sm font-medium">{{ amount }}</p>
        </div>
      </div>

      <div class="mt-6 flex gap-3">
        <button
          class="flex-1 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
          @click="router.push('/')"
        >
          메인으로 가기
        </button>
      </div>
    </div>
  </div>
</template>
