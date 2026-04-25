<script setup>
/* global TossPayments */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()

const inviteToken = computed(() => String(route.query.token || '').trim())

const isLoading = ref(true)
const loadError = ref('')
const isSubmitting = ref(false)

const joinInfo = ref(null)

const form = ref({
  receiver: '',
  phone: '',
  address: '',
})

const tossClientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

const amount = computed(() => {
  if (!joinInfo.value) return 0
  return Number(joinInfo.value.option_price || 0) * Number(joinInfo.value.quantity || 1)
})

const formatCurrency = (value) => `${Number(value || 0).toLocaleString()}원`

const buildGroupBuyOrderCode = (memberId) => {
  return `gbm_${memberId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const loadJoinInfo = async () => {
  isLoading.value = true
  loadError.value = ''

  if (!inviteToken.value) {
    loadError.value = '초대 링크가 올바르지 않습니다. 링크를 다시 확인해 주세요.'
    isLoading.value = false
    return
  }

  try {
    const { data, error } = await supabase.rpc('get_group_buy_join_info', {
      p_token: inviteToken.value,
    })

    if (error) {
      throw new Error(`공동구매 참여정보 RPC 호출 실패: ${error.message}`)
    }

    const row = Array.isArray(data) ? data[0] : null
    if (!row) {
      loadError.value = '유효하지 않거나 만료된 공동구매 링크예요.'
      return
    }

    if (row.payment_status === 'paid') {
      loadError.value = '이미 결제가 완료된 링크예요.'
      return
    }

    joinInfo.value = row
  } catch (error) {
    console.error('공동구매 참여 정보 조회 에러:', error)
    loadError.value =
      error instanceof Error
        ? error.message
        : '공동구매 참여 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    isLoading.value = false
  }
}

const openTossPayment = async ({ orderCode, totalAmount, orderName, customerName }) => {
  const tossPayments = TossPayments(tossClientKey)
  const payment = tossPayments.payment({
    customerKey: 'group-buy-guest',
  })

  await payment.requestPayment({
    method: 'CARD',
    amount: {
      currency: 'KRW',
      value: totalAmount,
    },
    orderId: orderCode,
    orderName,
    customerName,
    successUrl: `${window.location.origin}/payment/success`,
    failUrl: `${window.location.origin}/payment/fail`,
  })
}

const submitAndPay = async () => {
  if (!joinInfo.value) return

  const receiver = form.value.receiver.trim()
  const phone = form.value.phone.trim()
  const address = form.value.address.trim()

  if (!receiver || !phone || !address) {
    alert('수령인, 연락처, 주소를 모두 입력해 주세요.')
    return
  }

  isSubmitting.value = true

  try {
    const orderCode = buildGroupBuyOrderCode(joinInfo.value.member_id)

    const { error } = await supabase.from('orders').insert([
      {
        product_id: joinInfo.value.product_id,
        product_name: joinInfo.value.product_name,
        option_id: joinInfo.value.option_id,
        option_name: joinInfo.value.option_name,
        quantity: joinInfo.value.quantity,
        total_amount: amount.value,
        recipient_name: receiver,
        recipient_phone: phone,
        recipient_address: address,
        recipient_zonecode: '',
        recipient_base_address: '',
        recipient_detail_address: address,
        delivery_message: '공동구매 참여 주문',
        user_id: null,
        order_code: orderCode,
        order_status: 'pending',
      },
    ])

    if (error) throw error

    await openTossPayment({
      orderCode,
      totalAmount: amount.value,
      orderName: `[공동구매] ${joinInfo.value.product_name} ${joinInfo.value.option_name}`,
      customerName: receiver,
    })
  } catch (error) {
    console.error('공동구매 참여 결제 준비 에러:', error)
    alert('결제 준비 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  await loadJoinInfo()
})
</script>

<template>
  <div class="min-h-screen bg-[#f9fafb] px-5 pb-16 pt-6 text-black">
    <div class="mx-auto w-full max-w-[430px] space-y-4">
      <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p class="text-xs font-semibold tracking-wide text-[#15aabf]">공동구매 참여</p>
        <h1 class="mt-2 text-xl font-bold">주소 입력 후 결제 진행</h1>
      </section>

      <section
        v-if="isLoading"
        class="rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-black/5"
      >
        참여 정보를 불러오는 중이에요...
      </section>

      <section
        v-else-if="loadError"
        class="rounded-2xl bg-white p-5 text-sm text-red-500 shadow-sm ring-1 ring-black/5"
      >
        <p>{{ loadError }}</p>
        <button
          type="button"
          class="mt-3 rounded-lg border border-black/15 px-3 py-2 text-xs text-black/70"
          @click="router.push('/group-buy')"
        >
          공동구매 홈으로
        </button>
      </section>

      <template v-else>
        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 class="text-base font-semibold">주문 정보</h2>
          <div class="mt-3 space-y-2 text-sm">
            <p><span class="text-black/60">상품:</span> {{ joinInfo.product_name }}</p>
            <p><span class="text-black/60">옵션:</span> {{ joinInfo.option_name }}</p>
            <p><span class="text-black/60">수량:</span> {{ joinInfo.quantity }}개</p>
            <p class="font-semibold">
              <span class="text-black/60 font-normal">결제 금액:</span>
              {{ formatCurrency(amount) }}
            </p>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 class="text-base font-semibold">배송 정보 입력</h2>

          <div class="mt-3 space-y-3">
            <label class="block text-xs text-black/60">
              수령인
              <input
                v-model="form.receiver"
                type="text"
                class="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                placeholder="수령인 이름"
              />
            </label>

            <label class="block text-xs text-black/60">
              연락처
              <input
                v-model="form.phone"
                type="text"
                class="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                placeholder="010-0000-0000"
              />
            </label>

            <label class="block text-xs text-black/60">
              주소
              <input
                v-model="form.address"
                type="text"
                class="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                placeholder="도로명 주소"
              />
            </label>
          </div>

          <button
            type="button"
            class="mt-4 w-full rounded-xl bg-[#15aabf] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/20"
            :disabled="isSubmitting"
            @click="submitAndPay"
          >
            {{ isSubmitting ? '결제 준비 중...' : `${formatCurrency(amount)} 결제하기` }}
          </button>
        </section>
      </template>
    </div>
  </div>
</template>
